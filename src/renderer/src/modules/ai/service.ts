import { useGet, usePost } from '@/plugin/http'
import type { AiProvideFormat } from '@/entity'
import type { AiCompletionResult, AiRequestParams, AiStreamChunk } from './types'
import { streamSseFrames } from './transport'
import { chatAdapter } from './formats/chat'
import { createResponsesAdapter } from './formats/responses'
import { createAnthropicAdapter } from './formats/anthropic'
import { AiFormatAdapter } from './formats/types'
import { normalizeBase } from './formats/util'

const createAdapter = (format: AiProvideFormat): AiFormatAdapter => {
  if (format === 'anthropic') return createAnthropicAdapter()
  if (format === 'responses') return createResponsesAdapter()
  return chatAdapter
}

/**
 * 统一 AI 流式对话入口：按 format 走对应适配器，逐 chunk 产出归一化数据。
 * - 非 2xx / 服务端错误：抛出带服务端 message 的 Error；
 * - 取消：signal.abort 或提前 break 迭代都会中止底层请求。
 */
export async function* createChatStream(params: AiRequestParams): AsyncGenerator<AiStreamChunk> {
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
 */
export const createChatCompletion = async (
  params: AiRequestParams
): Promise<AiCompletionResult> => {
  const adapter = createAdapter(params.format)
  const { url, headers, body } = adapter.buildRequest(params, false)
  const resp = await usePost<unknown>(url, body, { url, headers, signal: params.signal })
  return adapter.parseCompletion(resp.data)
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
