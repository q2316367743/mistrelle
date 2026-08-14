import type { AiCompletionResult, AiRequestParams, AiStreamChunk } from '../types'
import type { SseFrame } from '../sse'

/** 格式适配器：负责「归一化参数 → 厂商请求体 / SSE 帧 → 归一化 chunk」的转换 */
export interface AiFormatAdapter {
  buildRequest(
    params: AiRequestParams,
    stream: boolean
  ): {
    url: string
    headers: Record<string, string>
    body: Record<string, unknown>
  }
  /** 把一个 SSE 帧归一成 0..n 个 AiStreamChunk */
  normalizeChunk(frame: SseFrame): AiStreamChunk[]
  /** 解析非流式响应体 */
  parseCompletion(body: unknown): AiCompletionResult
}
