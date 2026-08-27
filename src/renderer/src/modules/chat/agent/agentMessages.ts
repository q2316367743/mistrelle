import type { Ref } from 'vue'
import type {
  AIMessage,
  AIMessageContent,
  ChatMessage,
  ChatMessageStatus,
  ChatUsage,
  TokenBreakdown,
  ToolCallContent
} from '@/domain'
import { nanoid } from 'nanoid'
import { prettyDurationTime, toDateString } from '@/utils/lang'
import { AiChatMode } from '@/entity'
import type { SubAgentType } from '@/modules/subagent/types'
import type { InteractiveKind } from './interactive'

export const createPendingAssistantMessage = (params: {
  model: string
  provide: string
  agentId?: string
  mode: AiChatMode
  thinking?: boolean
  reasoningEffort?: 'low' | 'high' | 'max'
}): AIMessage => ({
  role: 'assistant',
  content: [],
  status: 'pending',
  datetime: toDateString(null),
  id: nanoid(),
  model: params.model,
  provide: params.provide,
  agentId: params.agentId,
  mode: params.mode,
  thinking: params.thinking,
  reasoning_effort: params.reasoningEffort
})

const getAssistant = (messages: Ref<ChatMessage[]>, messageId: string): AIMessage | undefined => {
  const message = messages.value.find((item) => item.id === messageId)
  return message?.role === 'assistant' ? message : undefined
}

export const appendAssistantContent = (
  messages: Ref<ChatMessage[]>,
  messageId: string,
  content: AIMessageContent
): void => {
  const assistant = getAssistant(messages, messageId)
  if (!assistant) return
  const contents = assistant.content ?? (assistant.content = [])
  const last = contents[contents.length - 1]

  if (last?.type === content.type && last.stepId === content.stepId) {
    if (last.type === 'text' && content.type === 'text') {
      last.data += content.data
      return
    }
    if (last.type === 'markdown' && content.type === 'markdown') {
      last.data += content.data
      return
    }
    if (last.type === 'reasoning' && content.type === 'reasoning') {
      last.data.push(...content.data)
      return
    }
    if (last.type === 'thinking' && content.type === 'thinking') {
      last.data.title = '思考中'
      last.data.text = (last.data.text ?? '') + (content.data.text ?? '')
      return
    }
  }

  contents.push(content)
  // 只收尾流式文本类前块：text/markdown/reasoning/thinking 需要在后续内容开始时结束流式态；
  // toolcall 等结构块的生命周期归执行器管理（pending → complete 由结果回填驱动）。
  // 若在此无条件改写，同一批后续工具块入列会把先行的待审批块误标为 complete，
  // 卡片/横幅以「未完成」为判定条件，导致非末位待审操作永不渲染（2026-08-27 实证）
  const previous = contents[contents.length - 2]
  if (
    previous &&
    (previous.type === 'text' ||
      previous.type === 'markdown' ||
      previous.type === 'reasoning' ||
      previous.type === 'thinking')
  ) {
    previous.status = 'complete'
    if (previous.type === 'thinking') {
      previous.data.title = `思考完成 (用时 ${prettyDurationTime(Date.now() - previous.time)})`
    }
  }
}

/** 移除指定步骤已写入的全部 content（流式重试前清理失败尝试的半截内容，避免重试成功后文本重复） */
export const removeStepContents = (
  messages: Ref<ChatMessage[]>,
  messageId: string,
  stepId: string
): void => {
  const assistant = getAssistant(messages, messageId)
  if (!assistant?.content) return
  assistant.content = assistant.content.filter((item) => item.stepId !== stepId)
}

/**
 * 写入步骤级提示（如重试状态）：已存在同 retryKey 的块则原地更新 data（重试收尾时
 * 该块可能已被恢复后的正文盖住，需全量查找），否则追加到末尾。
 * retryKey 每个重试序列唯一，续跑同一消息时不会覆盖历史提示。
 */
export const upsertStepNotice = (
  messages: Ref<ChatMessage[]>,
  messageId: string,
  retryKey: string,
  data: string
): void => {
  const assistant = getAssistant(messages, messageId)
  const existing = assistant?.content?.find(
    (item) => item.type === 'text' && item.ext?.retryKey === retryKey
  )
  if (existing && existing.type === 'text') {
    existing.data = data
    return
  }
  appendAssistantContent(messages, messageId, {
    type: 'text',
    data,
    time: Date.now(),
    ext: { retryKey }
  })
}

export const updateToolCallContent = (
  messages: Ref<ChatMessage[]>,
  messageId: string,
  toolCallId: string,
  result: string,
  ext?: Record<string, unknown>
): void => {
  const assistant = getAssistant(messages, messageId)
  const content = assistant?.content?.findLast(
    (item): item is ToolCallContent =>
      item.type === 'toolcall' && item.data.toolCallId === toolCallId
  )
  if (!content) return
  content.status = 'complete'
  content.data.result = result
  // 结构化附加数据（如 ask 的问答对）写入 ext，供 UI 结果卡片渲染，不进模型上下文
  if (ext) content.ext = { ...(content.ext ?? {}), ...ext }
}

/**
 * 标记工具调用为「等待用户决策」的交互类型（ask / confirm）。
 * 该标记随消息持久化，应用重启后据此恢复挂起的交互。
 */
export const markToolInteractive = (
  messages: Ref<ChatMessage[]>,
  messageId: string,
  toolCallId: string,
  kind: InteractiveKind
): void => {
  const assistant = getAssistant(messages, messageId)
  const content = assistant?.content?.findLast(
    (item): item is ToolCallContent =>
      item.type === 'toolcall' && item.data.toolCallId === toolCallId
  )
  if (!content) return
  content.ext = { ...(content.ext ?? {}), interactive: kind }
}

/**
 * 标记工具进入「执行中」（handler 实际开始前调用）：生命周期显式三段式
 * pending（已接收 / 待审批）→ streaming（执行中）→ complete（applyResult 终态）。
 * pending 不再承担执行中语义，任何未被 applyResult 触达的块都能被状态判定准确识别。
 */
export const markToolExecuting = (
  messages: Ref<ChatMessage[]>,
  messageId: string,
  toolCallId: string
): void => {
  const assistant = getAssistant(messages, messageId)
  const content = assistant?.content?.findLast(
    (item): item is ToolCallContent =>
      item.type === 'toolcall' && item.data.toolCallId === toolCallId
  )
  if (!content || content.status === 'complete') return
  content.status = 'streaming'
}

export const setAssistantStatus = (
  messages: Ref<ChatMessage[]>,
  messageId: string,
  status: ChatMessageStatus
): void => {
  const assistant = getAssistant(messages, messageId)
  if (!assistant) return
  assistant.status = status
  const last = assistant.content?.[assistant.content.length - 1]
  if (last) last.status = status
  if (status === 'complete' || status === 'stop') {
    assistant.finishedAt = Date.now()
  }
}

/**
 * 记录 assistant 消息的 token 用量（agent loop 每步调用一次）：
 * - promptTokens：取最近一步（上下文随步骤增长，代表当前完整上下文）
 * - completionTokens / totalTokens：各步累加
 */
export const setAssistantUsage = (
  messages: Ref<ChatMessage[]>,
  messageId: string,
  usage: ChatUsage
): void => {
  const assistant = getAssistant(messages, messageId)
  if (!assistant) return
  assistant.usage = {
    promptTokens: usage.promptTokens,
    completionTokens: (assistant.usage?.completionTokens ?? 0) + usage.completionTokens,
    totalTokens: (assistant.usage?.totalTokens ?? 0) + usage.totalTokens
  }
}

/** 写入当前上下文的 token 构成估算（归一化到 promptTokens 后的精确值） */
export const setAssistantTokenBreakdown = (
  messages: Ref<ChatMessage[]>,
  messageId: string,
  breakdown: TokenBreakdown
): void => {
  const assistant = getAssistant(messages, messageId)
  if (!assistant) return
  assistant.tokenBreakdown = breakdown
}

/** 单个子 Agent 的汇总信息（供 UI tab 栏与侧边栏「Agent 记录」复用） */
export interface SubAgentInfo {
  subId: string
  /** 任务摘要（由 spawn_agent args 解析，可能为空） */
  task: string
  /** 子 Agent 能力类型（由 spawn_agent args 解析，缺省 research；用于侧边栏按类型联动） */
  type: SubAgentType
  status: 'running' | 'completed' | 'error'
  /** 所属 assistant 消息在所有 assistant 消息中的下标（用于判定「当前轮」） */
  messageIndex: number
}

/**
 * 从全部消息中收集所有 spawn_agent 工具调用，生成子 Agent 汇总列表。
 * subId 取自 toolcall.ext（与 appendSubAgentId 写入的映射一致），用于 UI 建立「工具卡片 ↔ 子 Agent」关系。
 */
export const collectSubAgents = (messages: ChatMessage[]): SubAgentInfo[] => {
  const result: SubAgentInfo[] = []
  let assistantIndex = -1
  for (const msg of messages) {
    if (msg.role !== 'assistant' || !msg.content) continue
    assistantIndex++
    for (const content of msg.content) {
      if (content.type !== 'toolcall' || content.data.toolCallName !== 'spawn_agent') continue
      const subId = content.ext?.subAgentId
      if (!subId || typeof subId !== 'string') continue
      let task = ''
      let type: SubAgentType = 'research'
      try {
        const parsed = JSON.parse(content.data.args ?? '{}') as { task?: string; type?: unknown }
        task = parsed.task ?? ''
        if (parsed.type === 'research' || parsed.type === 'design') type = parsed.type
      } catch {
        // args 解析失败则忽略任务摘要与类型
      }
      const s = content.status
      const status = s === 'error' ? 'error' : s === 'pending' || s === 'streaming' ? 'running' : 'completed'
      result.push({ subId, task, type, status, messageIndex: assistantIndex })
    }
  }
  return result
}

/** 最后一条 assistant 消息在所有 assistant 消息中的下标；无 assistant 消息返回 -1 */
export const lastAssistantIndexOf = (messages: ChatMessage[]): number => {
  let count = 0
  for (const m of messages) if (m.role === 'assistant') count++
  return count - 1
}

/** 最后一条 assistant 消息 id（无则空串），用于检测新一轮回复开始 */
export const lastAssistantIdOf = (messages: ChatMessage[]): string => {
  const last = messages.findLast((m) => m.role === 'assistant')
  return last?.id ?? ''
}

/**
 * 记录本条 assistant 回复过程中 spawn 的子 Agent ID。
 * 同步把 subAgentId 标记到对应 toolcall 的 ext 字段，供 UI 建立「工具卡片 ↔ 子 Agent」映射。
 */
export const appendSubAgentId = (
  messages: Ref<ChatMessage[]>,
  messageId: string,
  subAgentId: string,
  toolCallId?: string
): void => {
  const assistant = getAssistant(messages, messageId)
  if (!assistant) return
  const ids = assistant.subAgentIds ?? (assistant.subAgentIds = [])
  if (!ids.includes(subAgentId)) ids.push(subAgentId)
  if (toolCallId) {
    const content = assistant.content?.findLast(
      (item): item is ToolCallContent =>
        item.type === 'toolcall' && item.data.toolCallId === toolCallId
    )
    if (content) content.ext = { ...(content.ext ?? {}), subAgentId }
  }
}
