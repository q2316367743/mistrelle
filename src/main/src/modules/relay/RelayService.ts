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
 * - imageModels / imageGenerate / imageTask：生图域（/v1/images/*），统一异步任务模型；
 *   仅供主进程 ImageService 编排调用，渲染层经 image 域 IPC 间接使用。
 */
import axios from 'axios'
import type { Readable } from 'node:stream'
import { getRelayContext } from '../auth/AuthService'
import type { RelayChatParams } from '~/modules/relay/relayChannels'

const http = axios.create({
  timeout: 0,
  validateStatus: () => true
})

http.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error(error)
    return Promise.reject(error)
  }
)

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

/** 中转 GET（注入 Bearer）；非 2xx / 网络失败抛可读中文错误 */
async function relayGet<T>(path: string, fallbackError: string): Promise<T> {
  const ctx = getRelayContext()
  if (!ctx) throw new Error('未登录，无法访问内置服务')
  let resp
  try {
    resp = await http.get(`${ctx.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${ctx.apiKey}` }
    })
  } catch (error) {
    throw new Error(`无法连接服务端（${error instanceof Error ? error.message : '未知网络错误'}）`)
  }
  if (resp.status >= 400) {
    throw new Error(extractError(resp.status, resp.data, `${fallbackError}（HTTP ${resp.status}）`))
  }
  return resp.data as T
}

/** 拉取内置模型列表（GET {server}/v1/models，OpenAI list 形状 data[].id） */
export async function listModels(): Promise<Array<{ id: string }>> {
  const body = await relayGet<{ data?: unknown }>('/v1/models', '获取模型列表失败')
  const data = body?.data
  if (!Array.isArray(data)) throw new Error('接口返回格式异常，未找到模型列表')
  return data
    .map((item: unknown) =>
      item && typeof item === 'object' && 'id' in item ? String((item as { id: unknown }).id) : ''
    )
    .filter(Boolean)
    .map((id) => ({ id }))
}

// ── 生图域（/v1/images/*：档位模型列表 + 统一异步任务；HTTP 仅供主进程 ImageService 调用） ──

/** 服务端生图任务（提交与查询同构的顶层响应形状） */
export interface RelayImageTask {
  task_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  n: number
  error: string | null
  images?: Array<{ url?: string; b64_json?: string }>
}

/** 生图提交请求体（OpenAI images 入参兼容子集） */
export interface RelayImageGenerateBody {
  model: string
  prompt: string
  n?: number
  size?: string
}

/** 生图模型档位选项（服务端 /v1/images/models 直出 label/value，下拉可直接绑定） */
export interface RelayImageModel {
  label: string
  value: string
}

/** Result 包装（/api/* 与生图模型列表端点为该形状；/v1/models 仍为 OpenAI list 形状） */
interface RelayResultBody<T> {
  success?: boolean
  msg?: string
  data?: T
}

/** 生图模型列表（GET {server}/v1/images/models：Result 包装，data[] 直出档位 label/value） */
export async function imageModels(): Promise<RelayImageModel[]> {
  const body = await relayGet<RelayResultBody<unknown[]>>(
    '/v1/images/models',
    '获取生图模型列表失败'
  )
  if (body?.success === false) throw new Error(body.msg || '获取生图模型列表失败')
  const list = Array.isArray(body?.data) ? body.data : []
  return list
    .map((item): RelayImageModel | null => {
      if (!item || typeof item !== 'object' || !('value' in item)) return null
      const value = String((item as { value: unknown }).value)
      if (!value) return null
      const label = 'label' in item ? String((item as { label: unknown }).label) : value
      return { label: label || value, value }
    })
    .filter((item): item is RelayImageModel => item !== null)
}

/** 提交生图任务（POST {server}/v1/images/generations；业务错误经顶层 error 文案透出） */
export async function imageGenerate(body: RelayImageGenerateBody): Promise<RelayImageTask> {
  const ctx = getRelayContext()
  if (!ctx) throw new Error('未登录，无法使用生图服务')
  let resp
  try {
    resp = await http.post(`${ctx.baseUrl}/v1/images/generations`, body, {
      headers: { Authorization: `Bearer ${ctx.apiKey}`, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    throw new Error(`无法连接服务端（${error instanceof Error ? error.message : '未知网络错误'}）`)
  }
  if (resp.status >= 400) {
    throw new Error(extractError(resp.status, resp.data, `生图请求失败（HTTP ${resp.status}）`))
  }
  return resp.data
}

/** 查询生图任务状态（GET {server}/v1/images/tasks/{taskId}；processing 会实时查上游并结算） */
export async function imageTask(taskId: string): Promise<RelayImageTask> {
  return relayGet<RelayImageTask>(
    `/v1/images/tasks/${encodeURIComponent(taskId)}`,
    '生图任务查询失败'
  )
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
