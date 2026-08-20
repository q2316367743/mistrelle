/**
 * 历史工具调用的上下文紧凑化预扫描。
 *
 * 只作用于请求构建（回传给模型的消息），磁盘持久化的 args / result 原文不受影响。
 * 仅覆盖活跃 assistant 消息之前的历史：当前轮完整回传，保证轮内消息序列字节稳定
 * （对 prompt 前缀缓存友好），避免进行中任务被自己刚写入的占位参数打断。
 *
 * 写类必须「整对处理」：tool_calls 与配对 tool result 要么整对回传原文、要么整对剔除，
 * 禁止改写 args 的任何中间态——模型会模仿历史 tool_calls 的参数形态，占位串、
 * 删字段后的空 `{}` 都会被原样复制进新调用（两轮实测撞墙，见 docs/chat/12 §5）。
 */
import type { ChatMessage } from '@/domain'
import { toolContextRules, type ContextWalkState } from '@/modules/tool/contextRules'

/** 读类结果过期后的统一替换文案 */
export const EXPIRED_TOOL_RESULT_PLACEHOLDER =
  '[历史工具结果已省略：该资源后续已有更新的读取或写入，最新内容见后文；如需最新内容请重新调用相应读取工具]'

export interface ToolCallCompactPlan {
  /** result 替换为过期提示的 toolCallId 集合 */
  expiredToolCallIds: Set<string>
  /** 整对剔除（tool_calls 与配对 tool result 均不回传）的 toolCallId 集合 */
  droppedToolCallIds: Set<string>
}

interface ResourceEvent {
  kind: 'read' | 'write'
  key: string
  toolCallId: string
  /** 事件对应的原始结果，用于排除失败读取 / 判定写类成败 */
  result?: string
}

const parseArgs = (raw: string | undefined): Record<string, unknown> | undefined => {
  if (!raw) return undefined
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
    return Object.fromEntries(Object.entries(value))
  } catch {
    return undefined
  }
}

/** 失败调用不承载资源内容、也不改变资源状态（错误前缀由 serializeResult / runSingleTool 产出） */
const isFailedResult = (result: string | undefined): boolean =>
  !result || result.startsWith('{"error"') || result.startsWith('错误')

export const buildToolCallCompactPlan = (
  messages: ChatMessage[],
  activeAssistantMessageId: string
): ToolCallCompactPlan => {
  const plan: ToolCallCompactPlan = {
    expiredToolCallIds: new Set(),
    droppedToolCallIds: new Set()
  }
  const events: ResourceEvent[] = []
  const state: ContextWalkState = {}

  const activeIndex = messages.findIndex((message) => message.id === activeAssistantMessageId)
  for (const [index, message] of messages.entries()) {
    if (index >= activeIndex || message.role !== 'assistant') continue
    for (const content of message.content ?? []) {
      if (content.type !== 'toolcall') continue
      const call = content.data
      const rule = toolContextRules[call.toolCallName]
      if (!rule) continue
      const args = parseArgs(call.args)
      if (!args) continue

      if (rule.resource) {
        const key = rule.resource(args, state)
        if (key) events.push({ kind: 'read', key, toolCallId: call.toolCallId, result: call.result })
      }
      if (rule.writeResource) {
        const key = rule.writeResource(args, state)
        if (key) events.push({ kind: 'write', key, toolCallId: call.toolCallId, result: call.result })
      }
      if (rule.track) rule.track(args, state)
    }
  }

  // 每个 key 的最后事件决定读类新鲜度：最终是成功读取 → 该次保留原文，其余同 key 读取过期
  const lastByKey = new Map<string, ResourceEvent>()
  for (const event of events) lastByKey.set(event.key, event)
  const freshToolCallIds = new Set(
    [...lastByKey.values()]
      .filter((event) => event.kind === 'read' && !isFailedResult(event.result))
      .map((event) => event.toolCallId)
  )
  for (const event of events) {
    if (event.kind === 'read' && !freshToolCallIds.has(event.toolCallId)) {
      plan.expiredToolCallIds.add(event.toolCallId)
    }
  }

  // 写类：每个 key 仅保留最后一次成功写的完整原文（正确参数形态的参照样本），
  // 其余写（更早的成功写、全部失败写）整对剔除
  const lastOkWriteByKey = new Map<string, ResourceEvent>()
  for (const event of events) {
    if (event.kind === 'write' && !isFailedResult(event.result)) {
      lastOkWriteByKey.set(event.key, event)
    }
  }
  for (const event of events) {
    if (event.kind !== 'write') continue
    if (lastOkWriteByKey.get(event.key) !== event) plan.droppedToolCallIds.add(event.toolCallId)
  }
  return plan
}
