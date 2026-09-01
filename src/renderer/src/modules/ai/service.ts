import { useGet } from '@/plugin/http'
import type { AiProvideFormat } from '@/entity'
import type { AiCompletionResult, AiRequestParams, AiStreamChunk, AiUsage } from './types'
import { streamSseFrames } from './transport'
import { chatAdapter } from './formats/chat'
import { createResponsesAdapter } from './formats/responses'
import { createAnthropicAdapter } from './formats/anthropic'
import { AiFormatAdapter } from './formats/types'
import { normalizeBase } from './formats/util'
import { SseParser } from './sse'

const createAdapter = (format: AiProvideFormat): AiFormatAdapter => {
  if (format === 'anthropic') return createAnthropicAdapter()
  if (format === 'responses') return createResponsesAdapter()
  return chatAdapter
}

/**
 * 统一 AI 流式对话入口：按 format 走对应适配器，逐 chunk 产出归一化数据。
 * - 内置供应商（params.builtin）走主进程 relay IPC（服务端 apiKey 由主进程注入），其余直连 baseURL；
 * - 非 2xx / 服务端错误：抛出带服务端 message 的 Error；
 * - 取消：signal.abort 或提前 break 迭代都会中止底层请求。
 */
export async function* createChatStream(params: AiRequestParams): AsyncGenerator<AiStreamChunk> {
  if (params.builtin) {
    yield* createRelayChatStream(params)
    return
  }
  const adapter = createAdapter(params.format)
  const { url, headers, body } = adapter.buildRequest(params, true)
  for await (const frame of streamSseFrames({
    url,
    headers,
    body,
    signal: params.signal,
    method: 'POST'
  })) {
    yield* adapter.normalizeChunk(frame)
  }
}

/**
 * 统一 AI 非流式对话入口（会话命名 / 总结等短任务）。
 * 内部走流式通道聚合：部分服务端不支持 `stream: false` 会在传输前关闭连接（axios「stream has been aborted」），
 * 统一改由 createChatStream（`stream: true`）逐帧累积，契约 AiCompletionResult 不变。
 * 只累积 `delta.content` 正文；思考增量（`reasoning_content`）不混入——调用方均为短任务，思考全文只会污染标题 / 总结。
 */
export const createChatCompletion = async (
  params: AiRequestParams
): Promise<AiCompletionResult> => {
  let content = ''
  let finishReason: string | null = null
  let usage: AiUsage | undefined

  for await (const chunk of createChatStream(params)) {
    const choice = chunk.choices?.[0]
    const delta = choice?.delta
    if (delta?.content) content += delta.content
    // 兜底：个别服务端对 `stream: true` 仍返回非流式 JSON（只有 message 没有 delta）
    if (!content && choice?.message?.content) content = choice.message.content
    if (choice?.finish_reason) finishReason = choice.finish_reason
    if (chunk.usage) usage = chunk.usage
  }
  return { content, finishReason, usage }
}

/**
 * 拉取模型列表（AI 设置页）。
 * - chat / responses：GET {base}/models；
 * - anthropic：官方无公开的在线模型列表接口，抛错提示手动添加。
 */
export const listAiModels = async (options: {
  baseURL: string
  apiKey?: string
  format: AiProvideFormat
}): Promise<Array<{ id: string }>> => {
  if (options.format === 'anthropic') {
    throw new Error('Anthropic 格式不支持在线拉取模型列表，请手动添加模型')
  }
  const headers = options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : undefined
  const modelsUrl = `${normalizeBase(options.baseURL)}/models`
  const resp = await useGet<{ data?: unknown }>(modelsUrl, undefined, { url: modelsUrl, headers })
  const data = resp.data?.data
  if (!Array.isArray(data)) throw new Error('接口返回格式异常，未找到模型列表')
  return data
    .map((item) => (item && typeof item === 'object' && 'id' in item ? String(item.id) : ''))
    .filter(Boolean)
    .map((id) => ({ id }))
}

/**
 * 拉取内置供应商（服务端中转站）模型列表。
 * 凭证由主进程注入（GET {server}/v1/models），渲染层不接触 apiKey。
 */
export const listRelayModels = async (): Promise<Array<{ id: string }>> => {
  return window.preload.relay.listModels()
}

/** 从非 2xx 中转错误响应体中提取可读 message（OpenAI { error: { message } } 形状） */
function extractRelayError(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>
    const error = parsed['error']
    if (error && typeof error === 'object') {
      const message = (error as Record<string, unknown>)['message']
      if (typeof message === 'string') return message
    }
    if (typeof parsed['message'] === 'string') return parsed['message']
  } catch {
    // 非 JSON 错误体，退化为原文
  }
  const snippet = body.replace(/\s+/g, ' ').trim().slice(0, 200)
  return `HTTP ${status}${snippet ? `: ${snippet}` : ''}`
}

/**
 * 内置供应商（服务端中转站）流式对话入口。
 * 走主进程 relay IPC（main 注入 `Authorization: Bearer <apiKey>` + 透传 session_id），
 * 复用 chat 适配器构造 OpenAI chat 形状请求体与归一化 chunk；
 * 产出与 createChatStream 相同形状的 AiStreamChunk（协议解析仍在渲染层）。
 * 取消：signal.abort 触发 preload 桥 relay:abortStream 中止底层请求。
 */
export async function* createRelayChatStream(
  params: AiRequestParams
): AsyncGenerator<AiStreamChunk> {
  const { body } = chatAdapter.buildRequest(params, true)

  // 队列模式（与 plugin/http.ts requestStream 同款）：先拿响应头，再逐块消费字节流
  type RelayStartInfo = { requestId: string; status: number; headers: Record<string, string> }
  const queue: Uint8Array[] = []
  let waiter: (() => void) | null = null
  let settled = false
  let streamError: unknown = null
  let infoResolved = false
  let resolveInfo!: (info: RelayStartInfo) => void
  let rejectInfo!: (error: unknown) => void
  const infoPromise = new Promise<RelayStartInfo>((resolve, reject) => {
    resolveInfo = resolve
    rejectInfo = reject
  })

  const wake = (): void => {
    if (waiter) {
      const pending = waiter
      waiter = null
      pending()
    }
  }

  const donePromise = window.preload.relay.chatStream(
    { body, sessionId: params.sessionId },
    {
      onStart: (info) => {
        infoResolved = true
        resolveInfo(info)
      },
      onChunk: (chunk) => {
        queue.push(new Uint8Array(chunk))
        wake()
      }
    }
  )
  donePromise.then(
    () => {
      settled = true
      wake()
    },
    (error: unknown) => {
      settled = true
      streamError = error
      if (!infoResolved) rejectInfo(error)
      wake()
    }
  )

  const startInfo = await infoPromise

  // 非 2xx：收集错误体并抛可读错误（与 transport.buildHttpError 同语义）
  if (startInfo.status >= 400) {
    let errorText = ''
    for (;;) {
      if (queue.length > 0) {
        errorText += new TextDecoder().decode(queue.shift() as Uint8Array)
        continue
      }
      if (settled) break
      await new Promise<void>((resolve) => {
        waiter = resolve
      })
    }
    throw new Error(extractRelayError(startInfo.status, errorText))
  }

  // 取消：signal abort → streamAbort(requestId)
  let removeAbortListener: (() => void) | null = null
  if (params.signal) {
    if (params.signal.aborted) {
      window.preload.relay.streamAbort(startInfo.requestId)
    } else {
      const onAbort = (): void => {
        window.preload.relay.streamAbort(startInfo?.requestId ?? '')
      }
      params.signal.addEventListener('abort', onAbort, { once: true })
      removeAbortListener = () => params.signal?.removeEventListener('abort', onAbort)
    }
  }

  try {
    const decoder = new TextDecoder()
    const parser = new SseParser()
    for (;;) {
      if (queue.length > 0) {
        const text = decoder.decode(queue.shift() as Uint8Array, { stream: true })
        for (const frame of parser.feed(text)) {
          yield* chatAdapter.normalizeChunk(frame)
        }
        continue
      }
      if (settled) break
      await new Promise<void>((resolve) => {
        waiter = resolve
      })
    }
    for (const frame of parser.flush()) {
      yield* chatAdapter.normalizeChunk(frame)
    }
    if (streamError) throw streamError
  } finally {
    removeAbortListener?.()
  }
}
