/**
 * ffmpeg 桥（preload）：ffmpeg 执行的 IPC 薄封装（原 inject.ts 的 ffmpeg 段）。
 * 实现位于 main（modules/ffmpeg/ffmpegIpc.ts），进度/结束经 webContents.send 按 id 推送。
 */
import { ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  FfmpegChannels,
  type FfmpegProgress,
  type FfmpegRunResult,
  type FfmpegDonePayload
} from './ffmpegChannels'

interface InjectFfmpegPromise extends Promise<void> {
  kill(): void
  quit(): void
}

/**
 * 运行 ffmpeg：返回带 kill()/quit() 的 Promise（与 utools runFFmpeg 契约对齐）。
 * - 进度经 ffmpeg:progress 事件按 id 分发，回调 onProgress
 * - exit 0 → resolve；非 0 / 启动失败 → reject
 * - kill/quit 在 run 尚未返回 id 时先挂起，id 到达后补发（取消竞态安全）
 */
const ffmpegRun = (
  args: string[],
  onProgress?: (progress: FfmpegProgress) => void
): InjectFfmpegPromise => {
  let procId: number | undefined
  let pendingKill = false
  let pendingQuit = false
  let resolveFn: (() => void) | undefined
  let rejectFn: ((e: Error) => void) | undefined
  let removeListeners: (() => void) | null = null

  const promise = new Promise<void>((resolve, reject) => {
    resolveFn = resolve
    rejectFn = reject
  })

  void ipcRenderer
    .invoke(FfmpegChannels.run, args)
    .then(({ id }: FfmpegRunResult) => {
      procId = id
      if (pendingKill) ipcRenderer.send(FfmpegChannels.kill, id)
      if (pendingQuit) ipcRenderer.send(FfmpegChannels.quit, id)
      const onProgressEvent = (
        _e: IpcRendererEvent,
        payload: { id: number; progress: FfmpegProgress }
      ): void => {
        if (payload.id !== id) return
        onProgress?.(payload.progress)
      }
      const onDoneEvent = (_e: IpcRendererEvent, payload: FfmpegDonePayload): void => {
        if (payload.id !== id) return
        removeListeners?.()
        if (payload.error) rejectFn?.(new Error(payload.error))
        else resolveFn?.()
      }
      ipcRenderer.on(FfmpegChannels.progress, onProgressEvent)
      ipcRenderer.on(FfmpegChannels.done, onDoneEvent)
      removeListeners = () => {
        ipcRenderer.removeListener(FfmpegChannels.progress, onProgressEvent)
        ipcRenderer.removeListener(FfmpegChannels.done, onDoneEvent)
      }
    })
    .catch((e: Error) => {
      rejectFn?.(e)
    })

  const proc = promise as InjectFfmpegPromise
  proc.kill = (): void => {
    if (procId !== undefined) ipcRenderer.send(FfmpegChannels.kill, procId)
    else pendingKill = true
  }
  proc.quit = (): void => {
    if (procId !== undefined) ipcRenderer.send(FfmpegChannels.quit, procId)
    else pendingQuit = true
  }
  return proc
}

export const ffmpegApi = {
  run: ffmpegRun
}
