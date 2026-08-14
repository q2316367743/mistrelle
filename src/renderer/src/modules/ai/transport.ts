import { requestStream } from '@/plugin/http'
import { SseParser, SseFrame } from './sse'

export interface StreamTransportOptions {
  url: string
  method: 'POST' | 'GET'
  headers?: Record<string, string>
  body?: unknown
  signal?: AbortSignal
}

/**
 * 发起 AI 流式请求并把响应体解码为 SSE 帧序列（逐帧产出）。
 * - 非 2xx 状态：收集错误体并抛出带服务端 message 的 Error；
 * - 内部用 TextDecoder 增量解码，块边界与帧边界错位由 SseParser 处理。
 */
export async function* streamSseFrames(options: StreamTransportOptions): AsyncGenerator<SseFrame> {
  const { status, stream } = await requestStream({
    url: options.url,
    headers: options.headers,
    data: options.body,
    method: options.method,
    signal: options.signal
  })
  const decoder = new TextDecoder()

  if (status >= 400) {
    let errorText = ''
    for await (const chunk of stream) {
      errorText += decoder.decode(chunk, { stream: true })
    }
    errorText += decoder.decode()
    throw buildHttpError(status, errorText)
  }

  const parser = new SseParser()
  for await (const chunk of stream) {
    for (const frame of parser.feed(decoder.decode(chunk, { stream: true }))) {
      yield frame
    }
  }
  for (const frame of parser.flush()) {
    yield frame
  }
}

/** 从错误响应体中提取服务端 message，构造可读错误 */
function buildHttpError(status: number, body: string): Error {
  let message: string | undefined
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>
    const error = parsed['error']
    if (error && typeof error === 'object') {
      const errorMessage = (error as Record<string, unknown>)['message']
      if (typeof errorMessage === 'string') message = errorMessage
    }
    if (!message && typeof parsed['message'] === 'string') message = parsed['message']
  } catch {
    // 非 JSON 错误体，退化为原文
  }
  if (message) return new Error(`HTTP ${status}: ${message}`)
  const snippet = body.replace(/\s+/g, ' ').trim().slice(0, 200)
  return new Error(`HTTP ${status}${snippet ? `: ${snippet}` : ''}`)
}
