import type { AiRequestParams, AiStreamChunk } from '../types'
import type { SseFrame } from '../sse'
import { AiFormatAdapter } from './types'
import { isRecord, normalizeBase, toStreamError } from './util'

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
      // 缺省注入 Bearer 认证（可被 onRequest 的 headers 覆盖）
      headers: {
        ...(params.apiKey ? { Authorization: `Bearer ${params.apiKey}` } : {}),
        ...(params.headers ?? {})
      },
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
    // 服务端错误帧（200 + {"error":{...}}，无 choices）：转可见错误抛出。
    // 此前被消费层 !choice 静默丢弃，界面无声终止且无任何日志（实测：代理校验历史 toolcall
    // 参数失败回 500 错误帧，仅 471 字节）。code 为数字时附带 status 供重试策略分类
    const error = data['error']
    if (error) throw toStreamError(error)
    return [data as unknown as AiStreamChunk]
  }
}
