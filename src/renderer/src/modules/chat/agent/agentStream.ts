import type { AiMessageParam, AiTool } from '@/modules/ai'
import { createChatStream } from '@/modules/ai'
import type { Ref } from 'vue'
import type { ChatMessage, ChatUsage } from '@/domain'
import {
  extractReasoningContent,
  finishReasonToStatus,
  type ResolvedChatRequestParams,
  type ChatServiceConfig,
  type SSEChunkData
} from '@/modules/chat'
import { nanoid } from 'nanoid'
import { appendAssistantContent, setAssistantStatus } from './agentMessages'
import type { StreamStepResult, ToolCall } from './agentTypes'

type StreamOptions = {
  messages: Ref<ChatMessage[]>
  assistantMessageId: string
  requestParams: ResolvedChatRequestParams
  apiMessages: AiMessageParam[]
  tools: AiTool[]
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
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, String(value)]))
}

export const streamAgentStep = async (options: StreamOptions): Promise<StreamStepResult> => {
  const stepId = nanoid()

  // onRequest 覆盖：body 为格式原生覆盖项（chat 透传 thinking 等），headers 透传
  let bodyOverride: Record<string, unknown> | undefined
  let requestHeaders: Record<string, string> = {}
  const modified = await options.config.onRequest?.(options.requestParams)
  if (modified) {
    const customBody: unknown = Reflect.get(modified, 'body')
    if (customBody && typeof customBody === 'object') {
      bodyOverride = customBody as Record<string, unknown>
    }
    requestHeaders = toStringHeaders(modified.headers)
  }

  options.config.onStart?.('')
  setAssistantStatus(options.messages, options.assistantMessageId, 'streaming')
  const stream = createChatStream({
    baseURL: options.requestParams.baseURL,
    apiKey: options.requestParams.apiKey,
    format: options.requestParams.format ?? 'chat',
    model: options.requestParams.message.model,
    messages: options.apiMessages,
    tools: options.tools,
    thinking:
      typeof options.requestParams.message.thinking === 'boolean'
        ? options.requestParams.message.thinking
        : undefined,
    reasoningEffort: options.requestParams.message.reasoning_effort,
    signal: options.signal,
    headers: requestHeaders,
    bodyOverride
  })

  const accumulated = new Map<number, { id: string; name: string; args: string }>()
  let finishReason: string | null | undefined
  let usage: ChatUsage | undefined
  for await (const chunk of stream) {
    if (options.seq !== options.currentSeq()) return { cancelled: true, toolCalls: [], usage }
    // usage 常出现在末个 chunk（choices 为空），需在跳过前捕获
    if (chunk.usage) {
      usage = {
        promptTokens: chunk.usage.prompt_tokens,
        completionTokens: chunk.usage.completion_tokens,
        totalTokens: chunk.usage.total_tokens
      }
    }
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

  if (options.seq !== options.currentSeq()) return { cancelled: true, toolCalls: [], usage }
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
  // 存在待执行的工具调用时保持「执行中」：部分厂商在带 tool_calls 的返回里 finish_reason 仍是
  // stop，若按 finishReason 置为 complete，会让整条 assistant 消息在工具真正执行前就显示已完成
  if (toolCalls.length > 0) {
    setAssistantStatus(options.messages, options.assistantMessageId, 'streaming')
  } else {
    setAssistantStatus(
      options.messages,
      options.assistantMessageId,
      finishReasonToStatus(finishReason)
    )
  }
  return { cancelled: false, finishReason, toolCalls, usage }
}
