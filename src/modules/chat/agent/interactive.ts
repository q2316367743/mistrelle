import type { InjectionKey } from 'vue'
import { ref } from 'vue'
import type { ChatMessage } from '@/domain'
import type { ToolCall } from './agentTypes'

/**
 * 交互决策类型：
 * - ask：用户从选项中选择 / 输入答案，决策值为答案字符串
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

export type InteractiveDecision = string | boolean | null

/**
 * 工具执行与 UI 之间的「挂起决策」桥。每个 ToolChat 实例持有自己的 bridge，
 * 通过 provide/inject 暴露给 UI 卡片；无 UI 环境（setEnabled(false)，如讨论引擎）
 * 时 awaitDecision 立即返回 null，避免挂起。
 */
export class InteractiveBridge {
  readonly pending = ref<PendingInteractive | null>(null)
  private enabled = false
  private resolver: ((decision: InteractiveDecision) => void) | null = null

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
      this.pending.value = { kind, toolCallId, args }
      this.resolver = resolve
    })
  }

  resolve(toolCallId: string, decision: InteractiveDecision): void {
    if (this.pending.value?.toolCallId !== toolCallId) return
    this.resolver?.(decision)
    this.pending.value = null
    this.resolver = null
  }

  clear(): void {
    this.resolver?.(null)
    this.pending.value = null
    this.resolver = null
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
