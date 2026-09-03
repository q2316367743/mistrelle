/**
 * ffmpeg 域 IPC 契约：通道常量 + 进度/结束推送类型。
 * preload 桥与 main handler 共用，保持两侧契约一致。
 */
// ── ffmpeg ─────────────────────────────────────────────────
export const FfmpegChannels = {
  run: 'ffmpeg:run',
  kill: 'ffmpeg:kill',
  quit: 'ffmpeg:quit',
  /** main → renderer 进度推送（webContents.send） */
  progress: 'ffmpeg:progress',
  /** main → renderer 结束推送（webContents.send） */
  done: 'ffmpeg:done'
} as const

export interface FfmpegProgress {
  bitrate?: string
  fps?: number
  frame?: number
  percent?: number
  q?: number | string
  size?: string
  speed?: string
  time?: string
}

export interface FfmpegRunResult {
  id: number
}

export interface FfmpegDonePayload {
  id: number
  exitCode?: number | null
  signal?: string
  error?: string
}
