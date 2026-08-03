import type { InjectionKey } from 'vue'
import { ref } from 'vue'
import type { ChatMessage } from '@/domain'
import type { ToolCall } from './agentTypes'

/**
 * 交互决策类型：
 * - ask：用户从选项中选择 / 输入答案，决策值为答案字符串（单个问题）或答案字符串数组（多个问题）
 * - confirm：用户批准 / 拒绝工具执行，决策值为布尔
 */
export type InteractiveKind = 'ask' | 'confirm'

/** 挂起中的交互决策，UI 卡片据此渲染，用户作答后 resolve */
export interface PendingInteractive {
  toolCallId: string
  kind: InteractiveKind
  /** ask: { question, options }；confirm: 原始工具参数 */
  args: Record<string, unknown>
}

/** 队列中的交互决策：附带的 resolve 在轮到激活时由 activateNext 转交 activeResolve */
interface QueuedInteractive extends PendingInteractive {
  resolve: (decision: InteractiveDecision) => void
}

export type InteractiveDecision = string | boolean | string[] | null

/**
 * 工具执行与 UI 之间的「挂起决策」桥。每个 ToolChat 实例持有自己的 bridge，
 * 通过 provide/inject 暴露给 UI 卡片；无 UI 环境（setEnabled(false)，如讨论引擎）
 * 时 awaitDecision 立即返回 null，避免挂起。
 *
 * 工具并发执行时可能同时发起多个交互决策。桥内部按到达顺序排队，
 * 同一时刻只向 UI 暴露一个激活决策（pending），作答后自动切换到下一个，
 * 避免并发覆盖导致部分 Promise 永久挂起。
 */
export class InteractiveBridge {
  readonly pending = ref<PendingInteractive | null>(null)
  private enabled = false
  private queue: QueuedInteractive[] = []
  private activeResolve: ((decision: InteractiveDecision) => void) | null = null

  setEnabled(value: boolean): void {
    this.enabled = value
  }

  awaitDecision(
    kind: InteractiveKind,
    toolCallId: string,
    args: Record<string, unknown>
  ): Promise<InteractiveDecision> {
    if (!this.enabled) return Promise.resolve(null)
    return new Promise((resolve) => {
      this.queue.push({ kind, toolCallId, args, resolve })
      this.activateNext()
    })
  }

  /** 当前无激活决策时，从队首取出下一个暴露给 UI */
  private activateNext(): void {
    if (this.pending.value || this.queue.length === 0) return
    const next = this.queue.shift()!
    this.pending.value = { kind: next.kind, toolCallId: next.toolCallId, args: next.args }
    this.activeResolve = next.resolve
  }

  resolve(toolCallId: string, decision: InteractiveDecision): void {
    // 命中当前激活决策：兑现并激活下一个
    if (this.pending.value?.toolCallId === toolCallId) {
      this.activeResolve?.(decision)
      this.activeResolve = null
      this.pending.value = null
      this.activateNext()
      return
    }
    // 目标决策尚未轮到（仍在排队）：直接出队作废，防止其 Promise 悬挂
    const index = this.queue.findIndex((item) => item.toolCallId === toolCallId)
    if (index >= 0) {
      const [removed] = this.queue.splice(index, 1)
      removed.resolve(decision)
    }
  }

  clear(): void {
    for (const item of this.queue) item.resolve(null)
    this.queue = []
    this.activeResolve?.(null)
    this.activeResolve = null
    this.pending.value = null
  }
}

export const INTERACTIVE_KEY: InjectionKey<InteractiveBridge> = Symbol('interactiveBridge')

/**
 * 从消息流末尾向前查找最后一个「等待用户决策」的交互 toolcall。
 * 交互状态隐式落在持久化消息中（ext.interactive + 未完成），应用重启后可据此恢复。
 */
export const findPendingInteractiveToolcall = (
  messages: ChatMessage[]
): { assistantMessageId: string; call: ToolCall } | null => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message.role !== 'assistant') continue
    const contents = message.content ?? []
    for (let j = contents.length - 1; j >= 0; j--) {
      const item = contents[j]
      if (item.type !== 'toolcall') continue
      const kind = item.ext?.interactive
      if ((kind === 'ask' || kind === 'confirm') && item.status !== 'complete') {
        return {
          assistantMessageId: message.id,
          call: {
            toolCallId: item.data.toolCallId,
            toolCallName: item.data.toolCallName,
            args: item.data.args,
            stepId: item.stepId ?? ''
          }
        }
      }
    }
  }
  return null
}
