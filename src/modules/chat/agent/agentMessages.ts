import type { Ref } from 'vue'
import type {
  AIMessage,
  AIMessageContent,
  ChatMessage,
  ChatMessageStatus,
  ToolCallContent
} from '@/domain'
import { nanoid } from 'nanoid'
import { prettyDurationTime, toDateString } from '@/utils/lang'
import { AiChatMode } from '@/entity'
import type { InteractiveKind } from './interactive'

export const createPendingAssistantMessage = (params: {
  model: string
  provide: string
  agentId?: string
  mode: AiChatMode
}): AIMessage => ({
  role: 'assistant',
  content: [],
  status: 'pending',
  datetime: toDateString(null),
  id: nanoid(),
  model: params.model,
  provide: params.provide,
  agentId: params.agentId,
  mode: params.mode
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
  if (!last) return
  last.status = 'complete'
  if (last.type === 'thinking') {
    last.data.title = `思考完成 (用时 ${prettyDurationTime(Date.now() - last.time)})`
  }
}

export const updateToolCallContent = (
  messages: Ref<ChatMessage[]>,
  messageId: string,
  toolCallId: string,
  result: string
): void => {
  const assistant = getAssistant(messages, messageId)
  const content = assistant?.content?.findLast(
    (item): item is ToolCallContent =>
      item.type === 'toolcall' && item.data.toolCallId === toolCallId
  )
  if (!content) return
  content.status = 'complete'
  content.data.result = result
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

/** 单个子 Agent 的汇总信息（供 UI tab 栏与侧边栏「Agent 记录」复用） */
export interface SubAgentInfo {
  subId: string
  /** 任务摘要（由 spawn_agent args 解析，可能为空） */
  task: string
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
      try {
        const parsed = JSON.parse(content.data.args ?? '{}') as { task?: string }
        task = parsed.task ?? ''
      } catch {
        // args 解析失败则忽略任务摘要
      }
      const s = content.status
      const status = s === 'error' ? 'error' : s === 'pending' || s === 'streaming' ? 'running' : 'completed'
      result.push({ subId, task, status, messageIndex: assistantIndex })
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
