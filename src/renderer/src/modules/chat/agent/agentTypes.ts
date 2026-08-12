import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionCreateParamsStreaming
} from 'openai/resources/chat/completions'
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

export type AssistantRequestMessage = ChatCompletionAssistantMessageParam & {
  reasoning_content?: string
}

export type AgentStreamingBody = ChatCompletionCreateParamsStreaming & {
  // DeepSeek 思考模式开关（enabled/disabled），需随 body 直接透传
  thinking?: { type: 'enabled' | 'disabled' }
}

export type StreamStepResult = {
  cancelled: boolean
  finishReason?: string | null
  toolCalls: ToolCall[]
  /** 本次 API 请求的 token 用量（支持 usage 的流式接口才有） */
  usage?: ChatUsage
}
