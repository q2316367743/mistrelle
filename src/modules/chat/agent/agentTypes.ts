import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionCreateParamsStreaming
} from 'openai/resources/chat/completions'

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
  thinking?: { type: 'enabled' | 'disabled' }
}

export type StreamStepResult = {
  cancelled: boolean
  finishReason?: string | null
  toolCalls: ToolCall[]
}
