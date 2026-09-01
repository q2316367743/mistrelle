/**
 * 服务端中转服务（main 进程单例）：内置供应商 = mistrelle-server 的 OpenAI 兼容中转站。
 *
 * 设计要点（详见 docs/setting/ 下 AI 设置文档）：
 * - 凭证（长期 API Key）只存在于 AuthService，本服务经 getRelayContext() 取上下文后注入
 *   `Authorization: Bearer <apiKey>` 转发到 /v1/*，渲染层不可见凭证。
 * - listModels：GET {server}/v1/models（模型列表，OpenAI list 形状，仅需登录即有 apiKey）。
 * - chatStream：POST {server}/v1/chat/completions（OpenAI 兼容流式 SSE，服务端按积分记账；
 *   透传 session_id 作渠道亲和键、request_id 只作对账；缺省服务端回退 user / 用户 id）；
 *   字节流经 onChunk 逐块回调，abort 经 signal 取消（axios signal 会同时取消未发起的请求与进行中的流）。
 */
import axios from 'axios'
import type { Readable } from 'node:stream'
import { getRelayContext } from './AuthService'
import type { RelayChatParams } from '~/ipc/relayChannels'

const http = axios.create({
  timeout: 0,
  validateStatus: () => true
})

export interface RelayStreamCallbacks {
  /** 响应头就绪回调（首个数据块之前） */
  onStart?: (info: { status: number; headers: Record<string, string> }) => void
  /** 数据块回调：独立 ArrayBuffer（剥离共享池，与 aiStream 桥约定一致） */
  onChunk?: (chunk: ArrayBuffer) => void
}

/** 从非 2xx 响应体 / 网络错误中提取可读中文原因 */
function extractError(status: number, body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>
    const error = record['error']
    if (error && typeof error === 'object') {
      const e = error as Record<string, unknown>
      if (typeof e['message'] === 'string') return e['message']
    }
    if (typeof record['message'] === 'string') return record['message']
  }
  if (status >= 400) return `请求失败（HTTP ${status}）`
  return fallback
}

/** 拉取内置模型列表（GET {server}/v1/models，Bearer apiKey） */
export async function listModels(): Promise<Array<{ id: string }>> {
  const ctx = getRelayContext()
  if (!ctx) throw new Error('未登录，无法获取内置模型列表')
  let resp
  try {
    resp = await http.get(`${ctx.baseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${ctx.apiKey}` }
    })
  } catch (error) {
    throw new Error(`无法连接服务端（${error instanceof Error ? error.message : '未知网络错误'}）`)
  }
  if (resp.status >= 400) {
    throw new Error(extractError(resp.status, resp.data, `获取模型列表失败（HTTP ${resp.status}）`))
  }
  const data = resp.data?.data
  if (!Array.isArray(data)) throw new Error('接口返回格式异常，未找到模型列表')
  return data
    .map((item: unknown) =>
      item && typeof item === 'object' && 'id' in item ? String((item as { id: unknown }).id) : ''
    )
    .filter(Boolean)
    .map((id) => ({ id }))
}

/**
 * 发起中转对话流（POST {server}/v1/chat/completions）。
 * Promise 在流结束 / 中止后 resolve（{ aborted }）；非 2xx 或网络失败 reject。
 */
export async function chatStream(
  params: RelayChatParams,
  signal: AbortSignal,
  callbacks: RelayStreamCallbacks
): Promise<{ aborted: boolean }> {
  const ctx = getRelayContext()
  if (!ctx) throw new Error('未登录，无法使用内置供应商')
  const body: Record<string, unknown> = { ...params.body }
  if (params.sessionId) body.session_id = params.sessionId
  if (params.requestId) body.request_id = params.requestId

  let response
  try {
    response = await http.post(`${ctx.baseUrl}/v1/chat/completions`, body, {
      headers: { Authorization: `Bearer ${ctx.apiKey}`, 'Content-Type': 'application/json' },
      responseType: 'stream',
      signal
    })
  } catch (error) {
    if (signal.aborted) return { aborted: true }
    throw new Error(`无法连接服务端（${error instanceof Error ? error.message : '未知网络错误'}）`)
  }
  callbacks.onStart?.({
    status: response.status,
    headers: Object.fromEntries(
      Object.entries(response.headers as Record<string, unknown>)
    ) as Record<string, string>
  })

  const stream = response.data as Readable
  try {
    for await (const chunk of stream) {
      if (signal.aborted) break
      const buffer = chunk as Buffer
      const ab = new ArrayBuffer(buffer.byteLength)
      new Uint8Array(ab).set(buffer)
      callbacks.onChunk?.(ab)
    }
    return { aborted: signal.aborted }
  } catch (error) {
    if (signal.aborted) return { aborted: true }
    throw error
  }
}
