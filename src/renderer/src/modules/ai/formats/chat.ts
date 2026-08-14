import type { AiCompletionResult, AiRequestParams, AiStreamChunk } from '../types'
import type { SseFrame } from '../sse'
import { AiFormatAdapter } from './types'
import { isRecord, normalizeBase, strField, toUsage } from './util'

/**
 * OpenAI Chat Completions（/chat/completions）适配器。
 * SSE data 帧本身即为 AiStreamChunk 形状（choices/delta/content/reasoning_content/tool_calls/usage），
 * 以 `data: [DONE]` 收尾。DeepSeek 的 thinking（{type}）与 reasoning_effort 原样透传。
 */
export const chatAdapter: AiFormatAdapter = {
  buildRequest(params: AiRequestParams, stream: boolean) {
    const body: Record<string, unknown> = {
      model: params.model,
      messages: params.messages,
      stream
    }
    if (params.tools && params.tools.length > 0) {
      body.tools = params.tools
    }
    if (stream) {
      // 请求流式 usage，使末个 chunk 携带完整 token 统计
      body.stream_options = { include_usage: true }
    }
    if (typeof params.thinking === 'boolean') {
      body.thinking = { type: params.thinking ? 'enabled' : 'disabled' }
    }
    if (params.reasoningEffort) {
      body.reasoning_effort = params.reasoningEffort
    }
    if (params.bodyOverride) Object.assign(body, params.bodyOverride)
    return {
      url: `${normalizeBase(params.baseURL)}/chat/completions`,
      headers: params.headers ?? {},
      body
    }
  },

  normalizeChunk(frame: SseFrame): AiStreamChunk[] {
    if (!frame.data || frame.data === '[DONE]') return []
    let data: unknown
    try {
      data = JSON.parse(frame.data)
    } catch {
      return []
    }
    if (!isRecord(data)) return []
    return [data as unknown as AiStreamChunk]
  },

  parseCompletion(body: unknown): AiCompletionResult {
    if (!isRecord(body)) return { content: '' }
    const choices = Array.isArray(body['choices']) ? (body['choices'] as unknown[]) : []
    const choice = isRecord(choices[0]) ? choices[0] : undefined
    const message = choice
      ? isRecord(choice['message'])
        ? choice['message']
        : undefined
      : undefined
    return {
      content: strField(message ?? {}, 'content') ?? '',
      finishReason: strField(choice ?? {}, 'finish_reason'),
      usage: toUsage(body['usage'])
    }
  }
}
