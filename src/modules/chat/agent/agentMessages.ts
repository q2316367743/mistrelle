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
