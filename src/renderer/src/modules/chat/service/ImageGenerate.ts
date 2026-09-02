/**
 * 生图服务封装（统一入口 + 异步任务续轮询）。
 *
 * 兼容两类中转站对 POST /v1/images/generations 的不同返回（用户调研确认普遍存在差异）：
 * 1. OpenAI 标准同步：data[] 直接含 url 或 b64_json（dall-e 返回 url，gpt-image 系列默认 b64_json）
 * 2. 异步任务式（如 apimart GPT-Image-2）：data[] 含 task_id，需轮询 GET {base}/tasks/{task_id}，
 *    等 completed 后从 result.images[0].url[0] 取图
 *
 * 流程：defaultImageModel（设置→默认设置）→ optionMap 解析提供方 base/key/model →
 * POST {base}/images/generations → 自适应解析响应 → 将图片（b64_json 或 url）落盘到 path。
 *
 * 失败分类（GenerateImageError.kind）：
 * - terminal：远端已确认终态 / 提交即失败 / 落盘失败，无任务可续（只可删除）
 * - resumable：异步任务轮询超时 / 连续查询失败 / 响应异常，远端任务可能仍在跑——
 *   返回带 taskId + pollMaxAt（5 分钟查询窗口），由 resumeTaskPoll 对同一任务续轮询，
 *   不重新提交任务、不重复扣费。
 * 本模块是叶子模块（只依赖 @/plugin/http 与 @/store），不依赖 design / tool，无循环依赖。
 */
import { usePost, useGet, requestDownload } from '@/plugin/http'
import { useSettingAiStore, useSettingDefaultStore } from '@/store'

/** 异步任务轮询间隔（毫秒） */
const POLL_INTERVAL_MS = 3000
/** 异步任务单段轮询最大次数（≈ 5 分钟） */
const POLL_MAX_TIMES = 100
/** 连续失败容忍次数：达到该阈值才判定轮询失败（中途有效响应即清零） */
const POLL_MAX_CONSECUTIVE_FAILURES = 5
/** 缺省输出尺寸：部分中转站（如 V-API gpt-image 系列）强制要求 size，全模型通用的安全值 */
const DEFAULT_SIZE = '1024x1024'
/** 轮询失败分类（生成流程落库用） */
export type PollFailureKind = 'terminal' | 'resumable'

export interface GenerateImageParams {
  /** 生图提示词（建议使用详细英文描述） */
  prompt: string
  /** 输出图片文件绝对路径（.png） */
  path: string
  /** 可选：输出尺寸，如 "1024x1024"；缺省用 1024x1024 */
  size?: string
  /**
   * 可选：生图模型 optionMap key（格式 `${provideId}:${identifier}`，见 SettingAiStore.imageOptions）；
   * 缺省回退「设置 → 默认设置 → 默认生图模型」
   */
  model?: string
  /**
   * 可选：确认异步任务型（响应带 task_id）时的回调——调用方在开始轮询前
   * 把 task_id + pollMaxAt 落库（生成中即被中断也能跨重启续轮询）
   */
  onTaskCreated?: (taskId: string, pollMaxAt: number) => void
}

export interface GenerateImageResult {
  /** 落盘后的图片文件绝对路径 */
  path: string
  width?: number
  height?: number
}

/** 生图失败：error 为可读原因；kind 供调用方区分「任务可能仍在远端跑」与「任务已确认终态」 */
export interface GenerateImageError {
  error: string
  kind: PollFailureKind
  /** 异步任务型失败时存在：远端 task_id 与查询绝对截止时间（续轮询 resumeTaskPoll 用） */
  taskId?: string
  pollMaxAt?: number
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

/** 生图流程失败结果：kind=terminal（远端已确认终态，不可再轮询）/ resumable（任务可能仍在跑，可续） */
type PollOutcome = { ok: true; url: string } | { ok: false; error: string; kind: PollFailureKind }

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 轮询异步生图任务直到出图 / 确认失败 / 轮询次数耗尽。
 * maxTimes 允许小于 POLL_MAX_TIMES：续轮询按剩余窗口传入次数，不重新提交任务。
 * 判定：
 * - 任务明确 failed / cancelled → terminal（远端已确认终态，重试无意义）
 * - completed 但缺图 → terminal（已确认不会再有结果）
 * - 轮询次数耗尽（超时）→ resumable（远端任务可能仍在生成，可续轮询）
 * - 查询连续失败 / 响应异常 → resumable（远端状态未知，可能只是网络波动）
 */
const pollTaskImage = async (
  baseUrl: string,
  apiKey: string,
  taskId: string,
  maxTimes: number = POLL_MAX_TIMES
): Promise<PollOutcome> => {
  const url = `${baseUrl}/tasks/${encodeURIComponent(taskId)}`
  let consecutiveFailures = 0
  let lastError = '任务查询失败'
  for (let i = 0; i < maxTimes; i++) {
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
      consecutiveFailures++
      lastError = `任务查询失败：${extractRequestError(e)}`
      if (consecutiveFailures >= POLL_MAX_CONSECUTIVE_FAILURES)
        return { ok: false, error: lastError, kind: 'resumable' }
      continue
    }
    const info = getTaskInfo(respBody)
    if (!info) {
      consecutiveFailures++
      lastError = '任务查询响应异常：未返回任务信息'
      if (consecutiveFailures >= POLL_MAX_CONSECUTIVE_FAILURES)
        return { ok: false, error: lastError, kind: 'resumable' }
      continue
    }
    consecutiveFailures = 0
    const status = info['status']
    if (status === 'completed') {
      const imageUrl = extractTaskImageUrl(info)
      if (imageUrl) return { ok: true, url: imageUrl }
      return { ok: false, error: '生图任务已完成，但未返回图片地址', kind: 'terminal' }
    }
    if (status === 'failed' || status === 'cancelled') {
      const detail = extractTaskError(info) ?? `生图任务${status === 'failed' ? '失败' : '被取消'}`
      return { ok: false, error: detail, kind: 'terminal' }
    }
  }
  return { ok: false, error: '生图任务超时（约 5 分钟）：请稍后在服务端查询结果', kind: 'resumable' }
}

// ==========================================
//  落盘与尺寸
// ==========================================

const authHeaders = (apiKey: string): Record<string, string> => ({
  Authorization: `Bearer ${apiKey}`
})

/** 按 optionMap key 解析提供方 baseUrl / apiKey；返回 undefined 表示模型不可用 */
const resolveModelOption = async (
  modelKey: string | undefined | null
): Promise<{ baseUrl: string; option: { key: string } } | undefined> => {
  const resolvedKey = modelKey?.trim() || useSettingDefaultStore().state.defaultImageModel
  if (!resolvedKey) return undefined
  const aiStore = useSettingAiStore()
  if (!aiStore.ready) await aiStore.initPromise
  const option = aiStore.optionMap.get(resolvedKey)
  if (!option) return undefined
  return { baseUrl: option.baseUrl.trim().replace(/\/+$/, ''), option }
}

const ensureDir = async (path: string): Promise<void> => {
  await window.preload.fs.mkdir(window.preload.path.dirname(path), true)
}

export interface ResumeTaskPollParams extends GenerateImageParams {
  /** 已创建成功的远端异步任务标识（首次生成失败落库的 taskId） */
  taskId: string
  /** 远端任务查询绝对截止时间（落库的 pollMaxAt） */
  pollMaxAt: number
}

/**
 * 续轮询已创建的异步生图任务（不重新提交任务，不重复扣费）：
 * 直接按「首次创建时间戳 + 5 分钟窗口」的剩余时间继续查询同一 task_id。
 * 剩余窗口 ≤0 时任务已超时，直接返回 resumable 失败（不发起请求）。
 */
export const resumeTaskPoll = async (
  params: ResumeTaskPollParams
): Promise<GenerateImageResult | GenerateImageError> => {
  const remainMs = params.pollMaxAt - Date.now()
  if (remainMs <= 0) {
    return {
      error: '生图任务已超过可查询窗口（5 分钟）：远端任务不再保留，请重新生成',
      kind: 'resumable',
      taskId: params.taskId,
      pollMaxAt: params.pollMaxAt
    }
  }
  const resolved = await resolveModelOption(params.model)
  if (!resolved) {
    // 本地模型配置缺失，远端任务可能仍在跑：保持可续，待配置恢复后仍可再试
    return {
      error: '生图模型不存在或未启用：请在 AI 设置中检查该模型配置',
      kind: 'resumable',
      taskId: params.taskId,
      pollMaxAt: params.pollMaxAt
    }
  }
  // 按剩余窗口折算轮询次数（至少 1 次）；续轮询轮数最多 100 次（≈5 分钟）
  const remainTimes = Math.min(
    POLL_MAX_TIMES,
    Math.max(1, Math.ceil(remainMs / POLL_INTERVAL_MS))
  )
  const polled = await pollTaskImage(resolved.baseUrl, resolved.option.key, params.taskId, remainTimes)
  if (!polled.ok) {
    const err: GenerateImageError = { error: polled.error, kind: polled.kind, taskId: params.taskId, pollMaxAt: params.pollMaxAt }
    return err
  }
  return await saveImageFromUrl(polled.url, params)
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
 * 模型来源：显式 params.model 优先，缺省回退默认生图模型。
 * @returns 成功返回 { path, width?, height? }；失败返回 { error, kind }（异步任务型失败带 taskId / pollMaxAt）。
 */
export const generateImage = async (
  params: GenerateImageParams
): Promise<GenerateImageResult | GenerateImageError> => {
  const modelKey = params.model?.trim() || useSettingDefaultStore().state.defaultImageModel
  if (!modelKey) {
    return { error: '未配置生图模型：请在页面选择模型，或到 设置 → 默认设置 → 默认生图模型 配置后再试', kind: 'terminal' }
  }

  const aiStore = useSettingAiStore()
  if (!aiStore.ready) await aiStore.initPromise
  const option = aiStore.optionMap.get(modelKey)
  if (!option) {
    return { error: '生图模型不存在或未启用：请在 AI 设置中检查该模型配置', kind: 'terminal' }
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
    return { error: `生图请求失败：${extractRequestError(e)}`, kind: 'terminal' }
  }

  // 业务级错误：部分中转站 2xx 但带顶层 error 或 code!==200
  if (isRecord(respBody)) {
    if (
      isRecord(respBody['error']) ||
      (typeof respBody['code'] === 'number' && respBody['code'] !== 200)
    ) {
      return { error: extractErrorMessage(respBody, '生图接口返回错误'), kind: 'terminal' }
    }
  }

  const items = getDataList(respBody)

  // 异步任务模式
  const taskId = findTaskId(items)
  if (taskId) {
    // 确认异步任务型即把远端标识与查询窗口交回调（调用方落库）——
    // 轮询中任何失败 / 中断，记录都已带 task_id 可续轮询或跨重启恢复
    const pollMaxAt = Date.now() + POLL_MAX_TIMES * POLL_INTERVAL_MS
    params.onTaskCreated?.(taskId, pollMaxAt)
    const polled = await pollTaskImage(baseUrl, option.key, taskId)
    if (!polled.ok) {
      // 已确认终态的失败不可续；超时 / 查询异常任务可能仍在跑，带出 task_id 供续轮询
      const err: GenerateImageError = { error: polled.error, kind: polled.kind }
      if (polled.kind === 'resumable') {
        err.taskId = taskId
        err.pollMaxAt = pollMaxAt
      }
      return err
    }
    return await saveImageFromUrl(polled.url, params)
  }

  // 同步模式：b64_json / url
  const syncImage = findSyncImage(items)
  if (syncImage.b64) return await saveImageFromB64(syncImage.b64, params)
  if (syncImage.url) return await saveImageFromUrl(syncImage.url, params)
  return { error: '生图接口返回了无法识别的响应：未找到图片数据（url / b64_json / task_id）', kind: 'terminal' }
}

const saveImageFromUrl = async (
  url: string,
  params: GenerateImageParams
): Promise<GenerateImageResult | GenerateImageError> => {
  await ensureDir(params.path)
  try {
    await requestDownload({ url }, params.path)
  } catch {
    return { error: '图片下载失败：请检查网络或稍后重试', kind: 'terminal' }
  }
  const size = await readImageSize(params.path, params.size)
  return { path: params.path, ...size }
}

const saveImageFromB64 = async (
  b64: string,
  params: GenerateImageParams
): Promise<GenerateImageResult | GenerateImageError> => {
  await ensureDir(params.path)
  try {
    await saveBase64Image(b64, params.path)
  } catch {
    return { error: '图片数据保存失败：base64 解析异常，请重试', kind: 'terminal' }
  }
  const size = await readImageSize(params.path, params.size)
  return { path: params.path, ...size }
}
