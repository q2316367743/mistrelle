import type { AiMessageParam } from '@/modules/ai'
import type { ChatUsage } from '@/domain'

export type ToolCall = {
  toolCallId: string
  toolCallName: string
  stepId: string
  parentMessageId?: string
  args?: string
  chunk?: string
  result?: string
}

export type AssistantRequestMessage = AiMessageParam & {
  reasoning_content?: string
}

export type StreamStepResult = {
  cancelled: boolean
  finishReason?: string | null
  toolCalls: ToolCall[]
  /** 本次 API 请求的 token 用量（支持 usage 的流式接口才有） */
  usage?: ChatUsage
}
