/**
 * 画布视频 / GIF 逐帧导出管线（v3）。
 *
 * 方案 A（seek，POC 已验证）：构建离屏元素后对每个动画实例做时间定位 seek，
 * 逐帧 offscreen.export('png') 写帧，最后 ffmpeg 合并。seek 不自动循环，
 * 因此 delay / loop / swing 需在 seek 前手工折算到周期内时间（见 seekToTime）。
 *
 * 取消：每帧前检查 controller.signal.aborted 抛 CancelledError；
 * 编码阶段由 controller.cancel() 调用 ffmpeg kill() 中断。
 */
import { Leafer, Image as LeaferImage } from 'leafer-editor'
import '@leafer-in/animate'
import {
  buildDocElements,
  normalizeRegion,
  type CanvasExportRegion,
  type CanvasRenderNode
} from './canvasRender'
import type { CanvasAnimation, CanvasDoc, CanvasNode } from './canvasTypes'
import { buildCanvasOutputsDir } from './CanvasStore'
import { getVideoExportController, type VideoExportController } from './videoExportState'

export type CanvasVideoFormat = 'mp4' | 'gif' | 'webm'

export interface CanvasVideoOptions {
  /** 帧率，默认 30 */
  fps?: number
  /** 时长（秒），默认按动画最长时长；无动画时 2 */
  duration?: number
  /** 输出格式，默认 mp4 */
  format?: CanvasVideoFormat
  /** 导出区域（画布绝对坐标），缺省整张画布 */
  region?: CanvasExportRegion
  /** 分辨率缩放，默认 1（0.5 = 半分辨率） */
  scale?: number
  /** gif/webm 循环（mp4 忽略），默认 true */
  loop?: boolean
  /** 输出路径，缺省 沙盒 outputs/canvas-{version}.{ext} */
  outPath?: string
  /** 沙盒目录：定位缺省输出路径与临时帧目录 */
  sandboxDir?: string
}

/** 用户取消导出时抛出，handler 捕获后返回 { cancelled: true } 让 AI 感知 */
export class CancelledError extends Error {
  constructor() {
    super('视频导出已取消')
    this.name = 'CancelledError'
  }
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

/** 动画实例最小接口（@leafer-in/animate 运行时注入） */
interface AnimateLike {
  pause(): void
  seek(time: number, includeDelay?: boolean): void
}

interface AnimatedElementLike {
  animate?: () => AnimateLike | undefined
  animation?: unknown
  children?: unknown
}

/** 遍历 Leafer 子节点（LeafList 非数组，统一走 forEach） */
const eachChild = (children: unknown, fn: (child: unknown) => void): void => {
  ;(children as { forEach?: (cb: (item: unknown) => void) => void } | undefined)?.forEach?.(fn)
}

/** 动画实例 + 其配置（config 用于导出时折算时间） */
interface AnimatedEntry {
  animate: AnimateLike
  config: CanvasAnimation
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** 单个动画总播放时间（delay + 时长），供缺省导出时长计算 */
const animationTotalTime = (anim: CanvasAnimation): number => {
  const delay = anim.delay ?? 0
  const keyframes = anim.keyframes
  if (keyframes?.length) {
    const fixed = keyframes.reduce((sum, k) => sum + (k.duration ?? 0), 0)
    const total = anim.duration ?? (fixed > 0 ? fixed : 0.2 * keyframes.length)
    return delay + Math.max(total, fixed)
  }
  return delay + (anim.duration ?? 0.2)
}

/** 全画布动画最长播放时间（含 animationOut），无动画返回 0 */
export const maxAnimationTime = (doc: CanvasDoc): number => {
  let max = 0
  const walk = (nodes: CanvasNode[]): void => {
    for (const node of nodes) {
      if (node.animation) max = Math.max(max, animationTotalTime(node.animation))
      if (node.animationOut) max = Math.max(max, animationTotalTime(node.animationOut))
      if (node.children?.length) walk(node.children)
    }
  }
  walk(doc.nodes)
  return max
}

/**
 * 将视频时间 t 折算为单个动画的 seek 坐标。
 * seek 只定位到 [0, duration]，不处理循环：loop 用取模、swing 用三角波折叠，
 * 有限次数（loop/swing 为数字）超出后停在结束态；未开始的（t < delay）停在起始态。
 */
const seekToTime = (animate: AnimateLike, config: CanvasAnimation, t: number): void => {
  const duration = config.duration ?? 0.2
  const delay = config.delay ?? 0
  const loop = config.loop
  const swing = config.swing
  const r = t - delay
  let e: number
  if (r <= 0) {
    e = 0
  } else if (swing) {
    const maxLeg = typeof swing === 'number' ? 2 * swing - 1 : Infinity
    const leg = Math.floor(r / duration)
    if (leg >= maxLeg) e = duration
    else {
      const local = r - leg * duration
      // 奇数腿为 to -> from，用反向进度等价表达
      e = leg % 2 === 1 ? duration - local : local
    }
  } else if (loop) {
    const maxPass = typeof loop === 'number' ? loop : Infinity
    const pass = Math.floor(r / duration)
    e = pass >= maxPass ? duration : r - pass * duration
  } else {
    e = clamp(r, 0, duration)
  }
  animate.seek(e)
}

/** 收集元素树中所有带 animation 的实例（读取元素运行时属性，根 Group 无动画自动跳过） */
const collectAnimated = (roots: CanvasRenderNode[]): AnimatedEntry[] => {
  const out: AnimatedEntry[] = []
  const walk = (el: unknown): void => {
    const entry = el as AnimatedElementLike
    const animate = entry.animate?.()
    if (animate && isObject(entry.animation)) {
      out.push({ animate, config: entry.animation as CanvasAnimation })
    }
    eachChild(entry.children, walk)
  }
  for (const root of roots) walk(root)
  return out
}

/** 等待 image / svg 元素加载完成（防首帧空白），超时兜底跳过 */
const waitImagesReady = async (roots: CanvasRenderNode[], timeoutMs = 5000): Promise<void> => {
  const images: LeaferImage[] = []
  const walk = (el: unknown): void => {
    if (el instanceof LeaferImage) images.push(el as LeaferImage)
    eachChild((el as AnimatedElementLike).children, walk)
  }
  for (const root of roots) walk(root)
  await Promise.all(
    images.map(async (img) => {
      const t0 = Date.now()
      const imageLike = img as unknown as { ready?: boolean; image?: { ready?: boolean } }
      while (!imageLike.ready && !imageLike.image?.ready) {
        if (Date.now() - t0 > timeoutMs) return
        await new Promise((resolve) => setTimeout(resolve, 40))
      }
    })
  )
}

/** 离屏导出当前画布为 PNG Blob */
const exportFrame = async (
  offscreen: Leafer,
  width: number,
  height: number
): Promise<Blob> => {
  const result = await offscreen.export('png', {
    blob: true,
    screenshot: { x: 0, y: 0, width, height }
  })
  if (!(result.data instanceof Blob)) throw new Error('导出帧数据无效')
  return result.data
}

/** ffmpeg 合并帧序列，进度映射 90–100%；编码中取消由 controller.cancel() kill() 进程 */
const encodeFrames = async (
  framesDir: string,
  outPath: string,
  fps: number,
  format: CanvasVideoFormat,
  loop: boolean,
  controller: VideoExportController
): Promise<void> => {
  const input = window.preload.path.join(framesDir, 'frame_%05d.png')
  const args: string[] = [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-framerate',
    String(fps),
    '-i',
    input
  ]
  if (format === 'mp4') {
    args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18')
  } else if (format === 'webm') {
    args.push('-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '32', '-pix_fmt', 'yuv420p')
    if (loop) args.push('-loop', '0')
  } else {
    args.push('-vf', 'split[a][b];[a]palettegen[p];[b][p]paletteuse')
    if (loop) args.push('-loop', '0')
  }
  args.push(outPath)
  const total = controller.state.totalFrames
  const proc = window.preload.inject.ffmpeg.run(args, (p) => {
    const frame = Number(p.frame)
    if (Number.isFinite(frame) && total > 0) {
      controller.update({ progress: Math.min(100, 90 + Math.round((frame / total) * 10)) })
    }
  })
  controller.attachFfmpeg(proc)
  try {
    await proc
  } catch {
    if (controller.signal.aborted) throw new CancelledError()
    throw new Error('ffmpeg 合并失败，请检查输出路径与格式')
  }
}

/**
 * 导出画布动画为视频 / GIF。
 * 逐帧渲染进度映射 0→90（frame/total），ffmpeg 合并映射 90→100。
 * 成功返回 { path }；取消抛 CancelledError；任何异常走 finally 清理临时帧目录。
 */
export const exportCanvasVideo = async (
  doc: CanvasDoc,
  options: CanvasVideoOptions,
  controller: VideoExportController
): Promise<{ path: string }> => {
  const sandboxDir = options.sandboxDir
  if (!sandboxDir) throw new Error('视频导出缺少沙盒目录上下文')
  const fps = clamp(Math.round(options.fps ?? 30), 1, 60)
  const format = options.format ?? 'mp4'
  // 运行时白名单（模型 JSON 绕过 TS 类型，非法格式兜底报错而非静默按 gif 处理）
  if (format !== 'mp4' && format !== 'gif' && format !== 'webm') {
    throw new Error(`不支持的导出格式：${String(format)}，仅支持 mp4 / gif / webm`)
  }
  const scale = clamp(options.scale ?? 1, 0.1, 4)
  const region = normalizeRegion(options.region ?? { x: 0, y: 0, width: doc.width, height: doc.height })
  const duration =
    options.duration != null
      ? Math.max(0.1, options.duration)
      : Math.max(0.1, maxAnimationTime(doc) > 0 ? maxAnimationTime(doc) : 2)
  const total = Math.max(1, Math.round(fps * duration))
  const outputsDir = buildCanvasOutputsDir(sandboxDir)
  const outPath =
    options.outPath ??
    window.preload.path.join(outputsDir, `canvas-${doc.version}.${format}`)
  const framesDir = window.preload.path.join(outputsDir, `.video-frames-${Date.now()}`)

  const outW = Math.max(1, Math.round(region.width * scale))
  const outH = Math.max(1, Math.round(region.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  canvas.style.position = 'absolute'
  canvas.style.left = '-9999px'
  canvas.style.top = '0'
  document.body.appendChild(canvas)
  const offscreen = new Leafer({ view: canvas, width: outW, height: outH })

  controller.begin(total)
  try {
    await window.preload.fs.mkdir(framesDir, true)
    // 根 Group 以 region 原点平移 + scale 缩放，使 region 精确映射到完整画布
    const elements = buildDocElements(doc, scale, -region.x * scale, -region.y * scale)
    for (const element of elements) offscreen.add(element)
    await waitImagesReady(elements)
    // 暂停动画的 rAF 推进（pause 后 seek 仍可同步定位），保证逐帧确定性
    const animated = collectAnimated(elements)
    for (const entry of animated) entry.animate.pause()

    for (let frame = 0; frame < total; frame++) {
      if (controller.signal.aborted) throw new CancelledError()
      const t = frame / fps
      for (const entry of animated) seekToTime(entry.animate, entry.config, t)
      const blob = await exportFrame(offscreen, outW, outH)
      await window.preload.fs.writeBinaryFile(
        window.preload.path.join(framesDir, `frame_${String(frame).padStart(5, '0')}.png`),
        await blob.arrayBuffer()
      )
      controller.update({ frame: frame + 1, progress: Math.round(((frame + 1) / total) * 90) })
    }

    controller.update({ phaseLabel: '合并视频中', progress: 90 })
    await encodeFrames(framesDir, outPath, fps, format, options.loop ?? true, controller)
    return { path: outPath }
  } finally {
    if (window.preload.fs.existsSync(framesDir)) {
      await window.preload.fs.rm(framesDir)
    }
    offscreen.destroy()
    canvas.remove()
  }
}

export type VideoExportStartResult = { success: true; path: string } | { cancelled: true } | { error: string }

/**
 * 用户侧发起视频导出（UI 手动触发，非 AI 工具）：
 * 启动导出管线 → 成功后自动打开所在目录 → 遮罩状态流转（done/cancelled/error）并延迟复位。
 * 遮罩由全局 VideoExportOverlay.vue 订阅同一 controller，此函数返回结果供调用方兜底提示。
 */
export const startVideoExport = async (
  doc: CanvasDoc,
  options: CanvasVideoOptions
): Promise<VideoExportStartResult> => {
  const controller = getVideoExportController()
  try {
    const { path } = await exportCanvasVideo(doc, options, controller)
    window.preload.inject.shell.openPath(window.preload.path.dirname(path))
    controller.update({ status: 'done', progress: 100, outputPath: path })
    return { success: true, path }
  } catch (err) {
    if (err instanceof CancelledError) {
      controller.update({ status: 'cancelled' })
      return { cancelled: true }
    }
    const message = err instanceof Error ? err.message : String(err)
    controller.update({ status: 'error', error: message })
    return { error: message }
  } finally {
    // 短暂展示完成/取消/错误文案后淡出；若期间新导出已开始（rendering/encoding），不覆盖其状态
    setTimeout(() => {
      const s = controller.state.status
      if (s !== 'rendering' && s !== 'encoding') controller.reset()
    }, 1500)
  }
}
