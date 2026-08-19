/**
 * 历史工具调用的上下文紧凑化预扫描。
 *
 * 只作用于请求构建（回传给模型的消息），磁盘持久化的 args / result 原文不受影响。
 * 仅覆盖活跃 assistant 消息之前的历史：当前轮完整回传，保证轮内消息序列字节稳定
 * （对 prompt 前缀缓存友好），避免进行中任务被自己刚写入的占位参数打断。
 *
 * 写类参数只做「字段删除」：模型会模仿历史 tool_calls 的参数形态，args 中出现
 * 类型不符的占位串会被原样复制进新调用；省略说明放在配对工具 result 末尾
 * （role:'tool' 为自由文本，无格式污染）。
 */
import type { ChatMessage } from '@/domain'
import { toolContextRules, type ContextWalkState } from '@/modules/tool/contextRules'

/** 读类结果过期后的统一替换文案 */
export const EXPIRED_TOOL_RESULT_PLACEHOLDER =
  '[历史工具结果已省略：该资源后续已有更新的读取或写入，最新内容见后文；如需最新内容请重新调用相应读取工具]'

export interface ToolCallCompactPlan {
  /** result 替换为过期提示的 toolCallId 集合 */
  expiredToolCallIds: Set<string>
  /** toolCallId → 删除大字段后的 args 字符串 */
  slimmedArgs: Map<string, string>
  /** toolCallId → 被删除的字段名（回传时在配对工具结果末尾追加省略注记） */
  omittedArgFields: Map<string, string[]>
}

interface ResourceEvent {
  kind: 'read' | 'write'
  key: string
  toolCallId: string
  /** read 事件对应的原始结果，用于排除失败读取 */
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

/** 失败读取不承载资源内容、也不改变资源状态（错误前缀由 serializeResult / runSingleTool 产出） */
const isFailedResult = (result: string | undefined): boolean =>
  !result || result.startsWith('{"error"') || result.startsWith('错误')

/** 在工具结果末尾追加参数省略注记（result 侧自由文本，可安全携带说明与防模仿指令） */
export const appendOmittedArgsNote = (result: string, fields: string[]): string => {
  const note =
    `[系统注：为节省上下文，该历史调用的 ${fields.join('、')} 参数原文已省略，本条参数不完整；` +
    '新调用请按工具 schema 重新构造完整参数，切勿复用或参照本条参数形态]'
  return result ? `${result}\n${note}` : note
}

const stripArgFields = (parsed: Record<string, unknown>, fields: string[]): string => {
  for (const field of fields) delete parsed[field]
  return JSON.stringify(parsed)
}

export const buildToolCallCompactPlan = (
  messages: ChatMessage[],
  activeAssistantMessageId: string
): ToolCallCompactPlan => {
  const plan: ToolCallCompactPlan = {
    expiredToolCallIds: new Set(),
    slimmedArgs: new Map(),
    omittedArgFields: new Map()
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
        if (key) events.push({ kind: 'write', key, toolCallId: call.toolCallId })
      }
      if (rule.track) rule.track(args, state)
      if (rule.stripArgs && call.args) {
        const present = rule.stripArgs.filter((field) => parsedHas(args, field))
        if (present.length > 0) {
          plan.slimmedArgs.set(call.toolCallId, stripArgFields(args, present))
          plan.omittedArgFields.set(call.toolCallId, present)
        }
      }
    }
  }

  // 每个 key 的最后事件决定新鲜度：最终是成功读取 → 该次保留原文，其余同 key 读取过期
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
  return plan
}

const parsedHas = (args: Record<string, unknown>, field: string): boolean =>
  Object.prototype.hasOwnProperty.call(args, field) && args[field] !== undefined
