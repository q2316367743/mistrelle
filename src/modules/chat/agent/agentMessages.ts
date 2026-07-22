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

export const createPendingAssistantMessage = (): AIMessage => ({
  role: 'assistant',
  content: [],
  status: 'pending',
  datetime: toDateString(null),
  id: nanoid()
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
}
