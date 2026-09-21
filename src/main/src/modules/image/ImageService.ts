/**
 * 生图领域服务（main 进程单例）：文生图任务编排与全局运行态的唯一归属。
 *
 * 职责（渲染层只剩视图与 IPC 薄代理，详见 docs/attachment/03）：
 * - startGeneration：建记录（pending）→ RelayService.imageGenerate 提交 /api/images/generations →
 *   拿到 taskId 先落库（生成中中断也能跨重启续轮询）→ 轮询 /api/images/tasks/{id} →
 *   下载 / b64 逐张落盘 → 收尾 upsert → 广播 image:recordChanged。
 *   一次任务可出多张（n 1-4）：第 1 张快照进 path/width/height，全部进 images。
 * - 工具直出模式（record=false）：不建记录不广播，产物落盘指定 path 并等待终态返回
 *   （image_generate 工具用，不在页面历史留记录）。
 * - resume / remove：对同一远端任务续轮询（不重新提交、不重复扣费）；删除含 pending 取消集合语义
 *   （取消后完成时丢弃结果并清文件，防 upsert 复活）。
 * - cleanupOrphans：启动收尾，把不在运行中的遗留 pending（上次会话中断）标 failed。
 *
 * 运行态存模块闭包 Map：跨窗口、跨渲染层刷新存活；应用退出随进程结束（由启动收尾兜底）。
 */
import { app, BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { randomUUID } from 'crypto'
import {
  ImageChannels,
  type ImageGenerateInvokeResult,
  type ImageGenerateParams,
  type ImageTaskOutcome
} from '~/modules/image/imageChannels'
import type { ImageItem, ImageRecordInput } from '~/modules/db/dbChannels'
import { imageDelete, imageGet, imageList, imageUpsert } from '$/db/repo/imageRepo'
import {
  imageGenerate,
  imageTask,
  type RelayImageGenerateBody,
  type RelayImageTask
} from '../relay/RelayService'
import { sharpMetadata } from '../sharp/image'
import { appAxios } from '../network/appAxios'

/** 异步任务轮询间隔（毫秒） */
const POLL_INTERVAL_MS = 3000
/** 异步任务单段轮询最大次数（≈ 5 分钟窗口） */
const POLL_MAX_TIMES = 100
/** 连续失败容忍次数：达到该阈值才判定轮询失败（中途有效响应即清零） */
const POLL_MAX_CONSECUTIVE_FAILURES = 5
/** 单次生成张数上下限（与表单 / 工具约束一致） */
const N_MIN = 1
const N_MAX = 4
/** 参考图允许的本地扩展名 */
const REFERENCE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif']

/** 单个进行中任务的运行态 */
interface RunningTask {
  /** 关联记录（工具直出模式为 null） */
  record: ImageRecordInput | null
  /** 各张产物落盘路径（第 1 张与 record.path 一致；工具直出模式可能为空串） */
  paths: string[]
  size?: string
  /** 远端任务标识与查询窗口绝对截止时间（确认异步任务后回填） */
  taskId: string | null
  pollMaxAt: number | null
  /** 删除 pending 记录后置位：完成时丢弃结果并清理文件（防 upsert 复活） */
  cancelled: boolean
}

const running = new Map<string, RunningTask>()

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : '未知错误'

/** 文生图产物目录：~/.mistrelle/image/generate（与渲染层旧 Constant 约定一致） */
const imageGenerateDir = (): string => join(app.getPath('home'), '.mistrelle', 'image', 'generate')

/** 本地月份桶（yyyy-MM） */
const currentMonth = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** 记录生命周期推进：落库 + 向全部窗口广播 */
function persist(record: ImageRecordInput): void {
  imageUpsert(record)
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(ImageChannels.recordChanged, record)
  }
}

/**
 * 收尾一次生成：落库广播终态 + 回传 wait 调用方。
 * 取消任务丢弃结果并清文件（不落库不广播）；幂等（重复收尾直接返回）。
 */
function finish(task: RunningTask, key: string, outcome: ImageTaskOutcome): ImageTaskOutcome {
  if (!running.delete(key)) return outcome
  const record = task.record
  if (record && !task.cancelled) {
    const next: ImageRecordInput =
      'error' in outcome
        ? {
            ...record,
            status: 'failed',
            error: outcome.error,
            taskId: outcome.taskId ?? record.taskId,
            pollMaxAt: outcome.pollMaxAt ?? record.pollMaxAt,
            taskTerminal: outcome.kind === 'terminal'
          }
        : {
            ...record,
            status: 'success',
            width: outcome.width ?? null,
            height: outcome.height ?? null,
            images: outcome.images ?? record.images
          }
    task.record = next
    persist(next)
  }
  if (task.cancelled) {
    for (const path of task.paths) {
      if (path && existsSync(path)) rm(path).catch(() => {})
    }
  }
  return outcome
}

// ── 落盘与尺寸 ──

/** 下载 url 图片到本地 */
async function saveImageFromUrl(url: string, path: string): Promise<void> {
  const resp = await appAxios.get<ArrayBuffer>(url, { responseType: 'arraybuffer', timeout: 60_000 })
  await writeFile(path, Buffer.from(resp.data))
}

/** base64（可带 data URI 前缀）写入二进制文件 */
async function saveImageFromB64(b64: string, path: string): Promise<void> {
  const clean = b64.includes(',') ? b64.slice(b64.indexOf(',') + 1) : b64
  await writeFile(path, Buffer.from(clean, 'base64'))
}

/** 落盘后读取真实尺寸：sharp 优先，回退 size 解析 */
async function readSize(path: string, size?: string): Promise<{ width?: number; height?: number }> {
  try {
    const meta = await sharpMetadata(path)
    if (meta.width && meta.height) return { width: meta.width, height: meta.height }
  } catch {
    // 元信息读取失败则回退 size 解析
  }
  const match = /^(\d+)[xX](\d+)$/.exec((size ?? '').trim())
  if (!match) return {}
  const width = Number(match[1])
  const height = Number(match[2])
  return width > 0 && height > 0 ? { width, height } : {}
}

/** 从任务响应提取全部图片（b64 优先；上限 n，部分出图按实际张数收） */
function extractImages(resp: RelayImageTask, n: number): Array<{ url?: string; b64?: string }> {
  const out: Array<{ url?: string; b64?: string }> = []
  for (const image of resp.images ?? []) {
    if (out.length >= n) break
    if (image.b64Json) out.push({ b64: image.b64Json })
    else if (image.url) out.push({ url: image.url })
  }
  return out
}

// ── 执行链（提交 → 轮询 → 落盘 → 收尾；execute 不抛异常，终态一律经 finish 返回） ──

async function finishWithImages(
  task: RunningTask,
  key: string,
  resp: RelayImageTask
): Promise<ImageTaskOutcome> {
  const images = extractImages(resp, task.paths.length)
  if (!images.length) {
    return finish(task, key, {
      error: '生图任务已完成，但未返回图片数据',
      kind: 'terminal',
      taskId: task.taskId ?? undefined
    })
  }
  try {
    await mkdir(dirname(task.paths[0]), { recursive: true })
    const saved: ImageItem[] = []
    for (let i = 0; i < images.length; i++) {
      const path = task.paths[i]
      if (images[i].b64) await saveImageFromB64(images[i].b64 ?? '', path)
      else await saveImageFromUrl(images[i].url ?? '', path)
      const { width, height } = await readSize(path, task.size)
      saved.push({ path, width: width ?? null, height: height ?? null })
    }
    return finish(task, key, {
      path: saved[0].path,
      width: saved[0].width ?? undefined,
      height: saved[0].height ?? undefined,
      images: saved
    })
  } catch (error) {
    return finish(task, key, {
      error: `图片保存失败：${errorMessage(error)}`,
      kind: 'terminal',
      taskId: task.taskId ?? undefined
    })
  }
}

/**
 * 轮询异步生图任务直到出图 / 确认失败 / 查询窗口耗尽。
 * - failed → terminal（远端已确认终态，重试无意义）
 * - completed 缺图 → terminal
 * - 窗口耗尽 / 查询连续失败 → resumable（远端任务可能仍在跑，带 task_id 可续轮询）
 */
async function pollTask(
  task: RunningTask,
  key: string,
  taskId: string,
  maxTimes: number
): Promise<ImageTaskOutcome> {
  let consecutiveFailures = 0
  for (let i = 0; i < maxTimes; i++) {
    if (task.cancelled) return finish(task, key, { error: '任务已删除', kind: 'terminal' })
    await sleep(POLL_INTERVAL_MS)
    if (task.cancelled) return finish(task, key, { error: '任务已删除', kind: 'terminal' })
    let resp: RelayImageTask
    try {
      resp = await imageTask(taskId)
    } catch (error) {
      consecutiveFailures += 1
      if (consecutiveFailures >= POLL_MAX_CONSECUTIVE_FAILURES) {
        return finish(task, key, {
          error: `任务查询失败：${errorMessage(error)}`,
          kind: 'resumable',
          taskId,
          pollMaxAt: task.pollMaxAt ?? undefined
        })
      }
      continue
    }
    consecutiveFailures = 0
    if (resp.status === 'completed') return await finishWithImages(task, key, resp)
    if (resp.status === 'failed') {
      return finish(task, key, {
        error: resp.error || '生图任务失败',
        kind: 'terminal',
        taskId
      })
    }
  }
  return finish(task, key, {
    error: '生图任务超时（约 5 分钟）：远端任务可能仍在生成，可稍后重试续轮询',
    kind: 'resumable',
    taskId,
    pollMaxAt: task.pollMaxAt ?? undefined
  })
}

/** n 夹紧为 1-4 整数（表单 / 工具 schema 已约束，此处兜底防御） */
function clampN(n: number | undefined): number {
  const value = n == null || !Number.isFinite(n) ? 1 : Math.round(n)
  return Math.min(N_MAX, Math.max(N_MIN, value))
}

/** 参考图归一化：本地绝对路径读为 data URI；http(s) / data URI 原样透传 */
async function normalizeReferences(urls: string[]): Promise<string[]> {
  return Promise.all(
    urls.map(async (raw) => {
      const url = raw.trim()
      if (!url || /^(https?|data):/i.test(url)) return url
      const ext = url.split('.').pop()?.toLowerCase() ?? ''
      if (!REFERENCE_EXTS.includes(ext)) throw new Error(`不支持的参考图格式：${url}`)
      const buffer = await readFile(url)
      return `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${buffer.toString('base64')}`
    })
  )
}

/** 组装服务端请求体：n 恒传（clamp 1-4）；其余可选参数定义了才透传（避免不支持该参数的上游报错） */
async function buildBody(
  params: ImageGenerateParams,
  model: string,
  prompt: string
): Promise<RelayImageGenerateBody> {
  const body: RelayImageGenerateBody = { model, prompt, n: clampN(params.n) }
  const size = params.size?.trim()
  if (size) body.size = size
  const resolution = params.resolution?.trim()
  if (resolution) body.resolution = resolution
  const quality = params.quality?.trim()
  if (quality) body.quality = quality
  const background = params.background?.trim()
  if (background) body.background = background
  const outputFormat = params.outputFormat?.trim()
  if (outputFormat) body.outputFormat = outputFormat
  const moderation = params.moderation?.trim()
  if (moderation) body.moderation = moderation
  if (typeof params.outputCompression === 'number' && Number.isFinite(params.outputCompression)) {
    body.outputCompression = Math.min(100, Math.max(0, Math.round(params.outputCompression)))
  }
  if (params.nsfwCheck != null) body.nsfwCheck = params.nsfwCheck
  if (params.imageUrls?.length) {
    const refs = (await normalizeReferences(params.imageUrls)).filter(Boolean)
    if (refs.length) body.imageUrls = refs
  }
  return body
}

/** 单次生成的完整执行链（不抛异常） */
async function execute(
  task: RunningTask,
  key: string,
  params: ImageGenerateParams
): Promise<ImageTaskOutcome> {
  const model = params.model?.trim()
  const prompt = params.prompt.trim()
  if (!model || !prompt) {
    return finish(task, key, {
      error: !model ? '未配置生图模型：请选择模型或在设置中配置默认生图模型' : '缺少生图描述',
      kind: 'terminal'
    })
  }

  let body: RelayImageGenerateBody
  try {
    body = await buildBody(params, model, prompt)
  } catch (error) {
    return finish(task, key, {
      error: `参考图处理失败：${errorMessage(error)}`,
      kind: 'terminal'
    })
  }

  let resp: RelayImageTask
  try {
    resp = await imageGenerate(body)
  } catch (error) {
    return finish(task, key, {
      error: `生图请求失败：${errorMessage(error)}`,
      kind: 'terminal'
    })
  }
  if (resp.error) return finish(task, key, { error: resp.error, kind: 'terminal' })

  const taskId = typeof resp.taskId === 'string' ? resp.taskId : ''
  if (!taskId) {
    return finish(task, key, { error: '生图接口返回异常：未返回任务标识', kind: 'terminal' })
  }

  // 确认异步任务：先把远端标识与查询窗口落库（生成中中断也能跨重启续轮询），再轮询
  task.taskId = taskId
  task.pollMaxAt = Date.now() + POLL_MAX_TIMES * POLL_INTERVAL_MS
  if (task.record) {
    task.record = { ...task.record, taskId, pollMaxAt: task.pollMaxAt }
    persist(task.record)
  }

  // 提交响应可能直接终态（同步出图 / 提交即失败）
  if (resp.status === 'completed') return await finishWithImages(task, key, resp)
  if (resp.status === 'failed') {
    return finish(task, key, { error: resp.error || '生图任务失败', kind: 'terminal', taskId })
  }
  return await pollTask(task, key, taskId, POLL_MAX_TIMES)
}

// ── 对外入口（imageIpc 调用） ──

/** 落盘扩展名：跟随 outputFormat（png 缺省；jpeg 归一为 jpg） */
function imageExt(outputFormat?: string): string {
  const format = outputFormat?.trim().toLowerCase()
  if (format === 'jpeg' || format === 'jpg') return 'jpg'
  if (format === 'webp') return 'webp'
  return 'png'
}

/** 第 2 张起的路径派生：在扩展名前插入 -2/-3/-4 序号 */
function withIndexSuffix(path: string, index: number): string {
  const dot = path.lastIndexOf('.')
  const stem = dot > 0 ? path.slice(0, dot) : path
  const ext = dot > 0 ? path.slice(dot) : ''
  return `${stem}-${index}${ext}`
}

/**
 * 发起一次生成：
 * - 页面模式（record 缺省 true）：建 pending 记录落库并广播，立即返回；进展经广播推进。
 * - 工具直出 / wait 模式：等待终态返回结果（工具直出不建记录）。
 */
export function startGeneration(params: ImageGenerateParams): Promise<ImageGenerateInvokeResult> {
  const key = randomUUID()
  const toolMode = params.record === false
  const base = toolMode
    ? (params.path ?? '')
    : join(imageGenerateDir(), currentMonth(), `${key}.${imageExt(params.outputFormat)}`)
  const paths = Array.from({ length: clampN(params.n) }, (_, i) =>
    i === 0 ? base : withIndexSuffix(base, i + 1)
  )
  const record: ImageRecordInput | null = toolMode
    ? null
    : {
        id: key,
        prompt: params.prompt,
        model: params.model ?? null,
        styleName: params.styleName ?? null,
        size: params.size ?? null,
        path: paths[0],
        width: null,
        height: null,
        images: paths.map((path) => ({ path, width: null, height: null })),
        status: 'pending',
        error: null,
        taskId: null,
        pollMaxAt: null,
        taskTerminal: null,
        createdAt: Date.now()
      }
  const task: RunningTask = {
    record,
    paths,
    size: params.size,
    taskId: null,
    pollMaxAt: null,
    cancelled: false
  }
  running.set(key, task)
  if (record) persist(record)
  // execute 不抛异常；此处兜底防落库等意外异常变成 main 进程未处理 rejection
  const execution = execute(task, key, params).catch((error: unknown): ImageTaskOutcome =>
    finish(task, key, {
      error: `生图流程异常：${errorMessage(error)}`,
      kind: 'terminal'
    })
  )
  if (!record || params.wait) {
    return execution.then((result) => ({ phase: 'finished' as const, result }))
  }
  return Promise.resolve({ phase: 'started' as const, record })
}

/**
 * 续轮询一个异步任务型失败记录：记录原地改回 pending，对同一远端 task_id 继续查询
 * （不重新提交任务、不重复扣费），后续状态经广播推进。
 * 查询窗口只是单次轮询会话的本地预算（自研服务端任务持续可查，超时失败正是最该续询的场景），
 * 因此每次续轮询都给全新预算；已确认终态（task_terminal）的记录不可续。
 */
export async function resumeGeneration(id: string): Promise<void> {
  if (running.has(id)) return
  const record = imageGet(id)
  if (!record || record.status !== 'failed' || !record.taskId) return
  if (record.taskTerminal === true) return
  const pollMaxAt = Date.now() + POLL_MAX_TIMES * POLL_INTERVAL_MS
  const pending: ImageRecordInput = { ...record, status: 'pending', error: null, pollMaxAt }
  const paths = record.images?.length
    ? record.images.map((item) => item.path)
    : [record.path ?? '']
  const task: RunningTask = {
    record: pending,
    paths,
    size: record.size ?? undefined,
    taskId: record.taskId,
    pollMaxAt,
    cancelled: false
  }
  running.set(id, task)
  persist(pending)
  // 后续状态经广播推进，invoke 不必挂住整个轮询窗口
  void pollTask(task, id, record.taskId, POLL_MAX_TIMES)
}

/** 删除记录：联动取消 pending 任务（完成时丢弃结果）与删除全部落盘文件 */
export function removeGeneration(id: string): void {
  const task = running.get(id)
  if (task) task.cancelled = true
  imageDelete(id)
  const record = task?.record ?? imageGet(id)
  const paths = new Set<string>()
  if (record?.path) paths.add(record.path)
  for (const item of record?.images ?? []) paths.add(item.path)
  for (const path of paths) {
    if (path && existsSync(path)) rm(path).catch(() => {})
  }
}

/** 启动收尾：不在运行中的遗留 pending（上次会话中断）批量标 failed */
export function cleanupOrphans(): void {
  const stale = imageList({ status: 'pending' }, 500, 0)
  for (const record of stale.items) {
    if (running.has(record.id)) continue
    imageUpsert({ ...record, status: 'failed', error: '生成中断：应用退出或刷新' })
  }
}
