import type {
  ChatCompletionCreateParamsStreaming,
  ChatCompletionTool
} from 'openai/resources/chat/completions'
import type { Ref } from 'vue'
import type { ChatMessage } from '@/domain'
import {
  createClient,
  extractReasoningContent,
  finishReasonToStatus,
  type ResolvedChatRequestParams,
  type ChatServiceConfig,
  type SSEChunkData
} from '../engine/ChatCommon'
import { nanoid } from 'nanoid'
import { appendAssistantContent, setAssistantStatus } from './agentMessages'
import type { AgentStreamingBody, StreamStepResult, ToolCall } from './agentTypes'

type StreamOptions = {
  messages: Ref<ChatMessage[]>
  assistantMessageId: string
  requestParams: ResolvedChatRequestParams
  apiMessages: ChatCompletionCreateParamsStreaming['messages']
  tools: ChatCompletionTool[]
  config: ChatServiceConfig
  signal: AbortSignal
  seq: number
  currentSeq: () => number
}

const toStringHeaders = (headers: unknown): Record<string, string> => {
  if (headers instanceof Headers) {
    const entries: Array<[string, string]> = []
    headers.forEach((value, key) => entries.push([key, value]))
    return Object.fromEntries(entries)
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(
      headers.filter(
        (entry): entry is [string, string] =>
          Array.isArray(entry) &&
          entry.length === 2 &&
          typeof entry[0] === 'string' &&
          typeof entry[1] === 'string'
      )
    )
  }
  if (!headers || typeof headers !== 'object') return {}
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key, String(value)])
  )
}

export const streamAgentStep = async (options: StreamOptions): Promise<StreamStepResult> => {
  const stepId = nanoid()
  const body: AgentStreamingBody = {
    model: options.requestParams.model,
    messages: options.apiMessages,
    stream: true,
    tools: options.tools
  }
  if (options.requestParams.reasoning_effort) {
    body.reasoning_effort = options.requestParams.reasoning_effort
  }

  const finalBody: ChatCompletionCreateParamsStreaming = { ...body }
  let requestHeaders: Record<string, string> = {}
  const modified = await options.config.onRequest?.(options.requestParams)
  if (modified) {
    const customBody: unknown = Reflect.get(modified, 'body')
    if (customBody && typeof customBody === 'object') {
      Object.assign(finalBody, customBody)
    }
    requestHeaders = toStringHeaders(modified.headers)
  }

  options.config.onStart?.('')
  setAssistantStatus(options.messages, options.assistantMessageId, 'streaming')
  const stream = await createClient(options.requestParams.baseURL, options.requestParams.apiKey)
    .chat.completions.create(finalBody, {
      signal: options.signal,
      headers: requestHeaders
    })

  const accumulated = new Map<number, { id: string; name: string; args: string }>()
  let finishReason: string | null | undefined
  for await (const chunk of stream) {
    if (options.seq !== options.currentSeq()) return { cancelled: true, toolCalls: [] }
    const choice = chunk.choices?.[0]
    if (!choice) continue
    const sseChunk: SSEChunkData = { data: chunk, event: 'data' }
    if (options.config.isValidChunk && !options.config.isValidChunk(sseChunk)) continue
    finishReason = choice.finish_reason
    const delta = choice.delta
    const reasoning = extractReasoningContent(delta)
    if (reasoning) {
      appendAssistantContent(options.messages, options.assistantMessageId, {
        type: 'thinking',
        stepId,
        data: { text: reasoning, title: '正在思考' },
        status: 'streaming',
        time: Date.now()
      })
    }
    if (delta.content) {
      appendAssistantContent(options.messages, options.assistantMessageId, {
        type: 'markdown',
        stepId,
        data: delta.content,
        status: 'streaming',
        time: Date.now()
      })
    }
    for (const toolCall of delta.tool_calls ?? []) {
      const index = toolCall.index
      const current = accumulated.get(index) ?? { id: '', name: '', args: '' }
      if (toolCall.id) current.id = toolCall.id
      if (toolCall.function?.name) current.name = toolCall.function.name
      if (toolCall.function?.arguments) current.args += toolCall.function.arguments
      accumulated.set(index, current)
    }
  }

  if (options.seq !== options.currentSeq()) return { cancelled: true, toolCalls: [] }
  const toolCalls: ToolCall[] = Array.from(accumulated.values()).map((call) => ({
    toolCallId: call.id || `call_${nanoid()}`,
    toolCallName: call.name,
    args: call.args,
    stepId,
    parentMessageId: options.assistantMessageId
  }))
  for (const call of toolCalls) {
    appendAssistantContent(options.messages, options.assistantMessageId, {
      type: 'toolcall',
      stepId,
      status: 'pending',
      data: {
        toolCallId: call.toolCallId,
        toolCallName: call.toolCallName,
        args: call.args
      },
      time: Date.now()
    })
  }
  setAssistantStatus(
    options.messages,
    options.assistantMessageId,
    finishReasonToStatus(finishReason)
  )
  return { cancelled: false, finishReason, toolCalls }
}
