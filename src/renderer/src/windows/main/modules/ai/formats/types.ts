import type { AiRequestParams, AiStreamChunk } from '../types'
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
  /** 把一个 SSE 帧归一成 0..n 个 AiStreamChunk；服务端错误帧抛 Error（chat 格式 code 为数字时带 status 供重试分类） */
  normalizeChunk(frame: SseFrame): AiStreamChunk[]
}
