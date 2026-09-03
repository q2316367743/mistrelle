/**
 * 生图领域服务（main 进程单例）：文生图任务编排与全局运行态的唯一归属。
 *
 * 职责（渲染层只剩视图与 IPC 薄代理，详见 docs/attachment/03）：
 * - startGeneration：建记录（pending）→ RelayService.imageGenerate 提交 /v1/images/generations →
 *   拿到 task_id 先落库（生成中中断也能跨重启续轮询）→ 轮询 /v1/images/tasks/{id} →
 *   下载 / b64 落盘 → 收尾 upsert → 广播 image:recordChanged。
 * - 工具直出模式（record=false）：不建记录不广播，产物落盘指定 path 并等待终态返回
 *   （image_generate 工具用，不在页面历史留记录）。
 * - resume / remove：对同一远端任务续轮询（不重新提交、不重复扣费）；删除含 pending 取消集合语义
 *   （取消后完成时丢弃结果并清文件，防 upsert 复活）。
 * - cleanupOrphans：启动收尾，把不在运行中的遗留 pending（上次会话中断）标 failed。
 *
 * 运行态存模块闭包 Map：跨窗口、跨渲染层刷新存活；应用退出随进程结束（由启动收尾兜底）。
 */
import { app, BrowserWindow } from 'electron'
import axios from 'axios'
import { existsSync } from 'fs'
import { mkdir, rm, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { randomUUID } from 'crypto'
import {
  ImageChannels,
  type ImageGenerateInvokeResult,
  type ImageGenerateParams,
  type ImageTaskOutcome
} from '~/ipc/imageChannels'
import type { ImageRecordInput } from '~/ipc/dbChannels'
import { imageDelete, imageGet, imageList, imageUpsert } from '$/db/repo/imageRepo'
import { imageGenerate, imageTask, type RelayImageTask } from '$/auth/RelayService'
import { sharpMetadata } from '$/sharp/image'

/** 异步任务轮询间隔（毫秒） */
const POLL_INTERVAL_MS = 3000
/** 异步任务单段轮询最大次数（≈ 5 分钟窗口） */
const POLL_MAX_TIMES = 100
/** 连续失败容忍次数：达到该阈值才判定轮询失败（中途有效响应即清零） */
const POLL_MAX_CONSECUTIVE_FAILURES = 5
/** 缺省输出尺寸 */
const DEFAULT_SIZE = '1024x1024'

/** 单个进行中任务的运行态 */
interface RunningTask {
  /** 关联记录（工具直出模式为 null） */
  record: ImageRecordInput | null
  /** 产物落盘路径（建记录模式为预定的 {月桶}/{id}.png） */
  path: string
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
        : { ...record, status: 'success', width: outcome.width ?? null, height: outcome.height ?? null }
    task.record = next
    persist(next)
  }
  if (task.cancelled && record?.path && existsSync(record.path)) {
    rm(record.path).catch(() => {})
  }
  return outcome
}

// ── 落盘与尺寸 ──

/** 下载 url 图片到本地 */
async function saveImageFromUrl(url: string, path: string): Promise<void> {
  const resp = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer', timeout: 60_000 })
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

/** 从任务响应提取第一张图（url 或 b64_json） */
function extractImage(resp: RelayImageTask): { url?: string; b64?: string } {
  for (const image of resp.images ?? []) {
    if (image.b64_json) return { b64: image.b64_json }
    if (image.url) return { url: image.url }
  }
  return {}
}

// ── 执行链（提交 → 轮询 → 落盘 → 收尾；execute 不抛异常，终态一律经 finish 返回） ──

async function finishWithImages(
  task: RunningTask,
  key: string,
  resp: RelayImageTask
): Promise<ImageTaskOutcome> {
  const image = extractImage(resp)
  if (!image.url && !image.b64) {
    return finish(task, key, {
      error: '生图任务已完成，但未返回图片数据',
      kind: 'terminal',
      taskId: task.taskId ?? undefined
    })
  }
  try {
    await mkdir(dirname(task.path), { recursive: true })
    if (image.b64) await saveImageFromB64(image.b64, task.path)
    else await saveImageFromUrl(image.url ?? '', task.path)
  } catch (error) {
    return finish(task, key, {
      error: `图片保存失败：${errorMessage(error)}`,
      kind: 'terminal',
      taskId: task.taskId ?? undefined
    })
  }
  const { width, height } = await readSize(task.path, task.size)
  return finish(task, key, { path: task.path, width, height })
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

  let resp: RelayImageTask
  try {
    resp = await imageGenerate({
      model,
      prompt,
      n: 1,
      size: params.size?.trim() || DEFAULT_SIZE
    })
  } catch (error) {
    return finish(task, key, {
      error: `生图请求失败：${errorMessage(error)}`,
      kind: 'terminal'
    })
  }
  if (resp.error) return finish(task, key, { error: resp.error, kind: 'terminal' })

  const taskId = typeof resp.task_id === 'string' ? resp.task_id : ''
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

/**
 * 发起一次生成：
 * - 页面模式（record 缺省 true）：建 pending 记录落库并广播，立即返回；进展经广播推进。
 * - 工具直出 / wait 模式：等待终态返回结果（工具直出不建记录）。
 */
export function startGeneration(params: ImageGenerateParams): Promise<ImageGenerateInvokeResult> {
  const key = randomUUID()
  const toolMode = params.record === false
  const path = toolMode
    ? (params.path ?? '')
    : join(imageGenerateDir(), currentMonth(), `${key}.png`)
  const record: ImageRecordInput | null = toolMode
    ? null
    : {
        id: key,
        prompt: params.prompt,
        model: params.model ?? null,
        styleName: params.styleName ?? null,
        size: params.size ?? null,
        path,
        width: null,
        height: null,
        status: 'pending',
        error: null,
        taskId: null,
        pollMaxAt: null,
        taskTerminal: null,
        createdAt: Date.now()
      }
  const task: RunningTask = {
    record,
    path,
    size: params.size,
    taskId: null,
    pollMaxAt: null,
    cancelled: false
  }
  running.set(key, task)
  if (record) persist(record)
  // execute 不抛异常；此处兜底防落库等意外异常变成 main 进程未处理 rejection
  const execution = execute(task, key, params).catch(
    (error: unknown): ImageTaskOutcome =>
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
 * 续轮询一个可恢复的失败记录：记录原地改回 pending，对同一远端 task_id 按剩余窗口继续查询
 * （不重新提交任务、不重复扣费）。后续状态经广播推进。
 */
export async function resumeGeneration(id: string): Promise<void> {
  if (running.has(id)) return
  const record = imageGet(id)
  if (!record || record.status !== 'failed' || !record.taskId) return
  if (record.taskTerminal === true) return
  // 无窗口记录的旧数据：视为从当前起再给一个完整查询窗口
  const pollMaxAt = record.pollMaxAt ?? Date.now() + POLL_MAX_TIMES * POLL_INTERVAL_MS
  if (pollMaxAt - Date.now() <= 0) return
  const pending: ImageRecordInput = { ...record, status: 'pending', error: null, pollMaxAt }
  const task: RunningTask = {
    record: pending,
    path: record.path ?? '',
    size: record.size ?? undefined,
    taskId: record.taskId,
    pollMaxAt,
    cancelled: false
  }
  running.set(id, task)
  persist(pending)
  const remainTimes = Math.min(
    POLL_MAX_TIMES,
    Math.max(1, Math.ceil((pollMaxAt - Date.now()) / POLL_INTERVAL_MS))
  )
  // 后续状态经广播推进，invoke 不必挂住整个轮询窗口
  void pollTask(task, id, record.taskId, remainTimes)
}

/** 删除记录：联动取消 pending 任务（完成时丢弃结果）与删除落盘文件 */
export function removeGeneration(id: string): void {
  const task = running.get(id)
  if (task) task.cancelled = true
  imageDelete(id)
  const path = task?.record?.path ?? imageGet(id)?.path ?? null
  if (path && existsSync(path)) rm(path).catch(() => {})
}

/** 启动收尾：不在运行中的遗留 pending（上次会话中断）批量标 failed */
export function cleanupOrphans(): void {
  const stale = imageList({ status: 'pending' }, 500, 0)
  for (const record of stale.items) {
    if (running.has(record.id)) continue
    imageUpsert({ ...record, status: 'failed', error: '生成中断：应用退出或刷新' })
  }
}
