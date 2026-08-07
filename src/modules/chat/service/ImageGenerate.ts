/**
 * 生图服务封装（统一入口）。
 *
 * 兼容两类中转站对 POST /v1/images/generations 的不同返回（用户调研确认普遍存在差异）：
 * 1. OpenAI 标准同步：data[] 直接含 url 或 b64_json（dall-e 返回 url，gpt-image 系列默认 b64_json）
 * 2. 异步任务式（如 apimart GPT-Image-2）：data[] 含 task_id，需轮询 GET {base}/tasks/{task_id}，
 *    等 completed 后从 result.images[0].url[0] 取图
 *
 * 流程：defaultImageModel（设置→默认设置）→ optionMap 解析提供方 base/key/model →
 * POST {base}/images/generations → 自适应解析响应 → 将图片（b64_json 或 url）落盘到 path。
 * 本模块是叶子模块（只依赖 @/plugin/http 与 @/store），不依赖 design / tool，无循环依赖。
 */
import { usePost, useGet, requestDownload } from '@/plugin/http'
import { useSettingAiStore, useSettingDefaultStore } from '@/store'

/** 异步任务轮询间隔（毫秒） */
const POLL_INTERVAL_MS = 3000
/** 异步任务最大轮询次数（≈ 5 分钟） */
const POLL_MAX_TIMES = 100
/** 缺省输出尺寸：部分中转站（如 V-API gpt-image 系列）强制要求 size，全模型通用的安全值 */
const DEFAULT_SIZE = '1024x1024'

export interface GenerateImageParams {
  /** 生图提示词（建议使用详细英文描述） */
  prompt: string
  /** 输出图片文件绝对路径（.png） */
  path: string
  /** 可选：输出尺寸，如 "1024x1024"；缺省用 1024x1024 */
  size?: string
}

export interface GenerateImageResult {
  /** 落盘后的图片文件绝对路径 */
  path: string
  width?: number
  height?: number
}

// ==========================================
//  类型守卫（响应结构未知，避免 any / as 断言）
// ==========================================

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const isString = (v: unknown): v is string => typeof v === 'string'

/** 提取生成响应中的 data 列表（兼容 OpenAI { data:[...] } 与 apimart { code, data:[...] }） */
const getDataList = (body: unknown): unknown[] => {
  if (!isRecord(body)) return []
  return Array.isArray(body['data']) ? (body['data'] as unknown[]) : []
}

/** 同步模式：取 data[] 中第一个带 b64_json 或 url 的元素 */
const findSyncImage = (items: unknown[]): { b64?: string; url?: string } => {
  for (const item of items) {
    if (!isRecord(item)) continue
    const b64 = item['b64_json']
    if (isString(b64) && b64) return { b64 }
    const url = item['url']
    if (isString(url) && url) return { url }
  }
  return {}
}

/** 异步模式：取 data[] 中第一个 task_id */
const findTaskId = (items: unknown[]): string | undefined => {
  for (const item of items) {
    if (!isRecord(item)) continue
    const id = item['task_id']
    if (isString(id) && id) return id
  }
  return undefined
}

/** 从任意响应体中提取错误消息（兼容 { error:{ message } } / { message } / { code!==200 }） */
const extractErrorMessage = (body: unknown, fallback: string): string => {
  if (!isRecord(body)) return fallback
  const err = body['error']
  if (isRecord(err)) {
    const msg = err['message']
    if (isString(msg) && msg) return msg
  }
  const msg = body['message']
  if (isString(msg) && msg) return msg
  const code = body['code']
  if (typeof code === 'number' && code !== 200) return `${fallback}（code: ${code}）`
  return fallback
}

/** 从请求异常中提取可读错误（axios 抛错场景） */
const extractRequestError = (e: unknown): string => {
  if (isRecord(e)) {
    const response = e['response']
    if (isRecord(response)) {
      const msg = extractErrorMessage(response['data'], '请求失败')
      if (msg !== '请求失败') return msg
      const status = response['status']
      if (typeof status === 'number') return `HTTP ${status}`
    }
    const msg = e['message']
    if (isString(msg) && msg) return msg
  }
  return '网络异常'
}

// ==========================================
//  异步任务轮询（apimart GPT-Image-2 等）
// ==========================================

/** 提取任务对象：优先 body.data（apimart），回退 body 顶层 */
const getTaskInfo = (body: unknown): Record<string, unknown> | undefined => {
  if (!isRecord(body)) return undefined
  if (isRecord(body['data'])) return body['data']
  if (isString(body['status'])) return body
  return undefined
}

/** completed 任务里提取图片 URL：result.images[].url（string 或 string[]） */
const extractTaskImageUrl = (info: Record<string, unknown>): string | undefined => {
  const result = info['result']
  if (!isRecord(result)) return undefined
  const images = result['images']
  if (!Array.isArray(images)) return undefined
  for (const image of images) {
    if (!isRecord(image)) continue
    const url = image['url']
    if (isString(url) && url) return url
    if (Array.isArray(url)) {
      const first = url.find(isString)
      if (first) return first
    }
  }
  return undefined
}

/** 失败任务里的错误详情（info.error.message） */
const extractTaskError = (info: Record<string, unknown>): string | undefined => {
  const err = info['error']
  if (isRecord(err)) {
    const msg = err['message']
    if (isString(msg) && msg) return msg
  }
  const msg = info['message']
  if (isString(msg) && msg) return msg
  return undefined
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const pollTaskImage = async (
  baseUrl: string,
  apiKey: string,
  taskId: string
): Promise<{ url?: string; error?: string }> => {
  const url = `${baseUrl}/tasks/${encodeURIComponent(taskId)}`
  for (let i = 0; i < POLL_MAX_TIMES; i++) {
    await sleep(POLL_INTERVAL_MS)
    let respBody: unknown
    try {
      respBody = (
        await useGet<unknown>(url, undefined, {
          url,
          headers: authHeaders(apiKey)
        })
      ).data
    } catch (e) {
      return { error: `任务查询失败：${extractRequestError(e)}` }
    }
    const info = getTaskInfo(respBody)
    if (!info) continue
    const status = info['status']
    if (status === 'completed') {
      const imageUrl = extractTaskImageUrl(info)
      return imageUrl ? { url: imageUrl } : { error: '生图任务已完成，但未返回图片地址' }
    }
    if (status === 'failed' || status === 'cancelled') {
      return {
        error: extractTaskError(info) ?? `生图任务${status === 'failed' ? '失败' : '被取消'}`
      }
    }
  }
  return { error: '生图任务超时（约 5 分钟）：请稍后在服务端查询结果' }
}

// ==========================================
//  落盘与尺寸
// ==========================================

const authHeaders = (apiKey: string): Record<string, string> => ({
  Authorization: `Bearer ${apiKey}`
})

const ensureDir = async (path: string): Promise<void> => {
  await window.preload.fs.mkdir(window.preload.path.dirname(path), true)
}

/** base64（可带 data URI 前缀）写入二进制文件 */
const saveBase64Image = async (b64: string, path: string): Promise<void> => {
  const clean = b64.includes(',') ? b64.slice(b64.indexOf(',') + 1) : b64
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  await window.preload.fs.writeBinaryFile(path, bytes.buffer)
}

/** 从 size 形如 "1024x1024" 解析宽高 */
const resolveSize = (size?: string): { width?: number; height?: number } => {
  if (!size) return {}
  const match = /^(\d+)[xX](\d+)$/.exec(size.trim())
  if (!match) return {}
  const width = Number(match[1])
  const height = Number(match[2])
  return width > 0 && height > 0 ? { width, height } : {}
}

/** 落盘后读取真实尺寸：sharp 优先（uTools 环境），回退 size 解析 */
const readImageSize = async (
  path: string,
  size?: string
): Promise<{ width?: number; height?: number }> => {
  const sharp = window.preload.inject.sharp
  if (sharp) {
    try {
      const meta = await sharp.metadata(path)
      if (meta.width && meta.height) return { width: meta.width, height: meta.height }
    } catch {
      // 元信息读取失败则回退 size 解析
    }
  }
  return resolveSize(size)
}

// ==========================================
//  统一入口
// ==========================================

/**
 * 生成图片并保存到本地。
 * @returns 成功返回 { path, width?, height? }；失败返回 { error }。
 */
export const generateImage = async (
  params: GenerateImageParams
): Promise<GenerateImageResult | { error: string }> => {
  const defaultModel = useSettingDefaultStore().state.defaultImageModel
  if (!defaultModel) {
    return { error: '未配置默认生图模型：请到 设置 → 默认设置 → 默认生图模型 选择模型后再试' }
  }

  const aiStore = useSettingAiStore()
  if (!aiStore.ready) await aiStore.initPromise
  const option = aiStore.optionMap.get(defaultModel)
  if (!option) {
    return { error: '默认生图模型不存在或未启用：请在 AI 设置中检查该模型配置' }
  }

  const baseUrl = option.baseUrl.trim().replace(/\/+$/, '')
  const body: Record<string, unknown> = {
    model: option.model,
    prompt: params.prompt,
    n: 1,
    size: params.size?.trim() || DEFAULT_SIZE
  }

  let respBody: unknown
  try {
    respBody = (
      await usePost<unknown>(`${baseUrl}/images/generations`, body, {
        url: `${baseUrl}/images/generations`,
        headers: authHeaders(option.key)
      })
    ).data
  } catch (e) {
    return { error: `生图请求失败：${extractRequestError(e)}` }
  }

  // 业务级错误：部分中转站 2xx 但带顶层 error 或 code!==200
  if (isRecord(respBody)) {
    if (
      isRecord(respBody['error']) ||
      (typeof respBody['code'] === 'number' && respBody['code'] !== 200)
    ) {
      return { error: extractErrorMessage(respBody, '生图接口返回错误') }
    }
  }

  const items = getDataList(respBody)

  // 异步任务模式
  const taskId = findTaskId(items)
  if (taskId) {
    const polled = await pollTaskImage(baseUrl, option.key, taskId)
    if (!polled.url) return { error: polled.error ?? '生图任务未返回图片，请稍后重试' }
    return await saveImageFromUrl(polled.url, params)
  }

  // 同步模式：b64_json / url
  const syncImage = findSyncImage(items)
  if (syncImage.b64) return await saveImageFromB64(syncImage.b64, params)
  if (syncImage.url) return await saveImageFromUrl(syncImage.url, params)
  return { error: '生图接口返回了无法识别的响应：未找到图片数据（url / b64_json / task_id）' }
}

const saveImageFromUrl = async (
  url: string,
  params: GenerateImageParams
): Promise<GenerateImageResult | { error: string }> => {
  await ensureDir(params.path)
  try {
    await requestDownload({ url }, params.path)
  } catch {
    return { error: '图片下载失败：请检查网络或稍后重试' }
  }
  const size = await readImageSize(params.path, params.size)
  return { path: params.path, ...size }
}

const saveImageFromB64 = async (
  b64: string,
  params: GenerateImageParams
): Promise<GenerateImageResult | { error: string }> => {
  await ensureDir(params.path)
  try {
    await saveBase64Image(b64, params.path)
  } catch {
    return { error: '图片数据保存失败：base64 解析异常，请重试' }
  }
  const size = await readImageSize(params.path, params.size)
  return { path: params.path, ...size }
}
