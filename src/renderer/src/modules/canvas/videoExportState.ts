/**
 * 画布视频导出状态单例（对齐 getCanvasStore 惯例）：
 * ToolFunction.handler 无进度/取消通道，且导出由 agent 触发、用户可能位于任意页面，
 * 因此用模块级响应式单例承载导出进度，全局遮罩 VideoExportOverlay.vue 订阅同一实例。
 *
 * 同一时间只允许一个导出任务：新导出 begin() 前会 abort 上一个并清空引用。
 */
import { reactive } from 'vue'

export type VideoExportStatus = 'idle' | 'rendering' | 'encoding' | 'done' | 'cancelled' | 'error'

export interface VideoExportState {
  status: VideoExportStatus
  /** 阶段文案：'渲染帧中' | '合并视频中' */
  phaseLabel: string
  /** 0–100 */
  progress: number
  frame: number
  totalFrames: number
  outputPath?: string
  error?: string
}

export interface VideoExportController {
  /** Vue reactive 状态，供遮罩绑定 */
  readonly state: Readonly<VideoExportState>
  /** 逐帧循环检查的取消信号 */
  readonly signal: AbortSignal
  begin(totalFrames: number): void
  update(patch: Partial<VideoExportState>): void
  /** 挂载当前 ffmpeg 进程引用，取消时 kill() */
  attachFfmpeg(proc: InjectFfmpegPromise): void
  cancel(): void
  reset(): void
}

const state = reactive<VideoExportState>({
  status: 'idle',
  phaseLabel: '',
  progress: 0,
  frame: 0,
  totalFrames: 0
})

let abortController = new AbortController()
let ffmpegProc: InjectFfmpegPromise | null = null

export const getVideoExportController = (): VideoExportController => ({
  get state() {
    return state
  },
  get signal() {
    return abortController.signal
  },
  begin(totalFrames) {
    // 新导出前取消上一个任务并释放引用（AbortController 不可复用，需重建）
    abortController.abort()
    ffmpegProc = null
    abortController = new AbortController()
    Object.assign(state, {
      status: 'rendering',
      phaseLabel: '渲染帧中',
      progress: 0,
      frame: 0,
      totalFrames,
      outputPath: undefined,
      error: undefined
    })
  },
  update(patch) {
    Object.assign(state, patch)
  },
  attachFfmpeg(proc) {
    ffmpegProc = proc
  },
  cancel() {
    abortController.abort()
    if (ffmpegProc) {
      ffmpegProc.kill()
      ffmpegProc = null
    }
  },
  reset() {
    ffmpegProc = null
    Object.assign(state, {
      status: 'idle',
      phaseLabel: '',
      progress: 0,
      frame: 0,
      totalFrames: 0,
      outputPath: undefined,
      error: undefined
    })
  }
})
