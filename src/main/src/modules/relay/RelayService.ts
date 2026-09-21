/**
 * 服务端中转服务（main 进程单例）：内置供应商 = mistrelle-server 的 OpenAI 兼容中转站
 * （chat /v1/*）+ 自定义生图 API（/api/images）。
 *
 * 设计要点（详见 docs/setting/ 下 AI 设置文档）：
 * - 凭证（长期 API Key）只存在于 AuthService，本服务经 getRelayContext() 取上下文后注入
 *   `Authorization: Bearer <apiKey>`，渲染层不可见凭证。
 * - listModels：GET {server}/v1/models（模型列表，OpenAI list 形状，仅需登录即有 apiKey）。
 * - chatStream：POST {server}/v1/chat/completions（OpenAI 兼容流式 SSE，服务端按积分记账；
 *   透传 session_id 作渠道亲和键、request_id 只作对账；缺省服务端回退 user / 用户 id）；
 *   字节流经 onChunk 逐块回调，abort 经 signal 取消（axios signal 会同时取消未发起的请求与进行中的流）。
 * - imageModels / imageGenerate / imageTask：生图域（/api/images/*，Result + camelCase），
 *   统一异步任务模型；仅供主进程 ImageService 编排调用，渲染层经 image 域 IPC 间接使用。
 */
import type { Readable } from 'node:stream'
import { getRelayContext, getServerBaseUrl } from '../auth/AuthService'
import { createAppAxios } from '../network/appAxios'
import type { RelayChatParams } from '~/modules/relay/relayChannels'

const http = createAppAxios({
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

/** 从非 2xx 响应体 / 网络错误中提取可读中文原因（优先 Result.msg，兼容 OpenAI error） */
function extractError(status: number, body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>
    if (typeof record['msg'] === 'string' && record['msg']) return record['msg']
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

// ── 生图域（/api/images/*：档位模型列表 + 统一异步任务；HTTP 仅供主进程 ImageService 调用） ──

/** 服务端生图任务（Result.data；提交与查询同构） */
export interface RelayImageTask {
  taskId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  n: number
  error: string | null
  images?: Array<{ url?: string; b64Json?: string }>
}

/**
 * 生图提交请求体（服务端原样透传上游渠道；n 上限 10 由服务端校验）。
 * 与 ImageGenerateParams 的差异：本侧字段均已归一化（size 去空白、imageUrls 转 data URI）。
 */
export interface RelayImageGenerateBody {
  model: string
  prompt: string
  n?: number
  size?: string
  quality?: string
  resolution?: string
  background?: string
  outputFormat?: string
  outputCompression?: number
  moderation?: string
  nsfwCheck?: boolean
  imageUrls?: string[]
}

/** 生图模型档位选项（映射为 t-select options；priced 含 pointsPerImage） */
export interface RelayImageModel {
  label: string
  value: string
  pointsPerImage?: number
}

/** Result 包装（/api/*） */
interface RelayResultBody<T> {
  success?: boolean
  msg?: string
  data?: T
}

/** 解包 Result：非 success / 缺 data 抛错 */
function unwrapResult<T>(body: RelayResultBody<T> | undefined, fallback: string): T {
  if (body?.success === false) throw new Error(body.msg || fallback)
  if (body?.data === undefined) throw new Error(body?.msg || fallback)
  return body.data
}

/** 服务端档位行 → 下拉选项 */
function mapImageModel(item: unknown): RelayImageModel | null {
  if (!item || typeof item !== 'object' || !('code' in item)) return null
  const code = String((item as { code: unknown }).code)
  if (!code) return null
  const name =
    'name' in item && typeof (item as { name: unknown }).name === 'string'
      ? String((item as { name: string }).name)
      : code
  const points =
    'pointsPerImage' in item && typeof (item as { pointsPerImage: unknown }).pointsPerImage === 'number'
      ? (item as { pointsPerImage: number }).pointsPerImage
      : undefined
  return {
    label: points !== undefined ? `${name || code}（${points}积分）` : name || code,
    value: code,
    ...(points !== undefined ? { pointsPerImage: points } : {})
  }
}

/**
 * 生图模型列表：已登录走 /api/images/models/priced（含积分），否则公开 /api/images/models。
 * 映射为 label/value（+ 可选 pointsPerImage）供 t-select 绑定。
 */
export async function imageModels(): Promise<RelayImageModel[]> {
  const ctx = getRelayContext()
  const path = ctx ? '/api/images/models/priced' : '/api/images/models'
  let resp
  try {
    resp = await http.get(`${getServerBaseUrl()}${path}`, {
      headers: ctx
        ? { Authorization: `Bearer ${ctx.apiKey}` }
        : undefined
    })
  } catch (error) {
    throw new Error(`无法连接服务端（${error instanceof Error ? error.message : '未知网络错误'}）`)
  }
  if (resp.status >= 400) {
    throw new Error(extractError(resp.status, resp.data, `获取生图模型列表失败（HTTP ${resp.status}）`))
  }
  const list = unwrapResult<unknown[]>(resp.data as RelayResultBody<unknown[]>, '获取生图模型列表失败')
  if (!Array.isArray(list)) throw new Error('接口返回格式异常，未找到模型列表')
  return list.map(mapImageModel).filter((item): item is RelayImageModel => item !== null)
}

/** 提交生图任务（POST /api/images/generations；Result 包装） */
export async function imageGenerate(body: RelayImageGenerateBody): Promise<RelayImageTask> {
  const ctx = getRelayContext()
  if (!ctx) throw new Error('未登录，无法使用生图服务')
  let resp
  try {
    resp = await http.post(`${ctx.baseUrl}/api/images/generations`, body, {
      headers: { Authorization: `Bearer ${ctx.apiKey}`, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    throw new Error(`无法连接服务端（${error instanceof Error ? error.message : '未知网络错误'}）`)
  }
  if (resp.status >= 400) {
    throw new Error(extractError(resp.status, resp.data, `生图请求失败（HTTP ${resp.status}）`))
  }
  return unwrapResult(resp.data as RelayResultBody<RelayImageTask>, '生图请求失败')
}

/** 查询生图任务状态（GET /api/images/tasks/{taskId}；processing 会实时查上游并结算） */
export async function imageTask(taskId: string): Promise<RelayImageTask> {
  const body = await relayGet<RelayResultBody<RelayImageTask>>(
    `/api/images/tasks/${encodeURIComponent(taskId)}`,
    '生图任务查询失败'
  )
  return unwrapResult(body, '生图任务查询失败')
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

export interface RelayRewriteParams {
  content: string
  depth?: number
}

/**
 * 去 AI 味流式改写（POST {server}/api/rewrite）。
 * Promise 在流结束 / 中止后 resolve（{ aborted }）；非 2xx 或网络失败 reject。
 */
export async function rewriteStream(
  params: RelayRewriteParams,
  signal: AbortSignal,
  callbacks: RelayStreamCallbacks
): Promise<{ aborted: boolean }> {
  const ctx = getRelayContext()
  if (!ctx) throw new Error('未登录，无法使用去 AI 味')

  let response
  try {
    response = await http.post(
      `${ctx.baseUrl}/api/rewrite`,
      { content: params.content, depth: params.depth },
      {
        headers: { Authorization: `Bearer ${ctx.apiKey}`, 'Content-Type': 'application/json' },
        responseType: 'stream',
        signal
      }
    )
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
