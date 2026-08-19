/**
 * inject 桥（preload）：原 src-utools/src/inject.js 的 Electron 迁移。
 *
 * 设计约定（与 renderer 契约对齐）：
 * - 除 os.getPath 外全部异步（ipcRenderer.invoke）；getPath 因 Constant.ts 模块级同步初始化保留 sendSync
 * - 删除 utools 平台专有能力：window / browser / input / simulate / feature / purchase / redirect / screen / ai / team
 * - 删除事件钩子：onPluginEnter / onPluginOut / onPluginDetach / onDbPull / onMainPush / outPlugin /
 *   readCurrentFolderPath / readCurrentBrowserUrl
 * - runBrowser 为 browser_fetch / browser_actions 工具的统一桥：载荷（fetch/actions）直传 main，
 *   error 时 reject，resolve 最后一个数据项
 */
import { ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  ShellChannels,
  DialogChannels,
  DialogOpenOptions,
  DialogSaveOptions,
  ClipboardChannels,
  OsChannels,
  DisplayChannels,
  NotificationChannels,
  FfmpegChannels,
  SharpChannels,
  SharpRegion,
  SharpColorMapResult,
  FfmpegProgress,
  FfmpegRunResult,
  FfmpegDonePayload,
  BrowserToolChannels,
  type BrowserToolResult,
  type BrowserToolPayload
} from './channels'

// ── 类型（与 renderer 侧 types/inject.d.ts 对齐的简化契约） ──

interface InjectFfmpegPromise extends Promise<void> {
  kill(): void
  quit(): void
}

interface InjectClipboardFile {
  isFile: boolean
  isDirectory: boolean
  name: string
  path: string
}

// ── shell ──────────────────────────────────────────────────

const shell = {
  openExternal: (url: string): void => {
    void ipcRenderer.invoke(ShellChannels.openExternal, url).catch(() => {})
  },
  openPath: (fullPath: string): Promise<void> =>
    ipcRenderer.invoke(ShellChannels.openPath, fullPath),
  trashItem: (filename: string): Promise<void> =>
    ipcRenderer.invoke(ShellChannels.trashItem, filename),
  showItemInFolder: (fullPath: string): void => {
    void ipcRenderer.invoke(ShellChannels.showItemInFolder, fullPath).catch(() => {})
  },
  beep: (): void => {
    void ipcRenderer.invoke(ShellChannels.beep).catch(() => {})
  }
}

// ── dialog ─────────────────────────────────────────────────

const dialog = {
  open: (options: DialogOpenOptions): Promise<string[] | undefined> =>
    ipcRenderer.invoke(DialogChannels.open, options),
  save: (options: DialogSaveOptions): Promise<string | undefined> =>
    ipcRenderer.invoke(DialogChannels.save, options)
}

// ── clipboard ──────────────────────────────────────────────

const clipboard = {
  copyText: (text: string): Promise<boolean> =>
    ipcRenderer.invoke(ClipboardChannels.copyText, text),
  copyFile: (file: string | string[]): Promise<boolean> =>
    ipcRenderer.invoke(ClipboardChannels.copyFile, file),
  copyImage: (img: string | Uint8Array): Promise<boolean> =>
    ipcRenderer.invoke(ClipboardChannels.copyImage, img),
  getCopyedFiles: (): Promise<InjectClipboardFile[]> =>
    ipcRenderer.invoke(ClipboardChannels.getCopyedFiles)
}

// ── os ─────────────────────────────────────────────────────

const os = {
  isDarkColors: (): Promise<boolean> => ipcRenderer.invoke(OsChannels.isDarkColors),
  isMacOS: (): boolean => process.platform === 'darwin',
  isWindows: (): boolean => process.platform === 'win32',
  isLinux: (): boolean => process.platform === 'linux',
  isDev: (): Promise<boolean> => ipcRenderer.invoke(OsChannels.isDev),
  /** utools 用户体系在 Electron 无对应，恒返回 null（renderer 已有兜底） */
  getNativeId: (): Promise<string | null> => ipcRenderer.invoke(OsChannels.getNativeId),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke(OsChannels.getAppVersion),
  getAppName: (): Promise<string> => ipcRenderer.invoke(OsChannels.getAppName),
  /** 唯一同步方法：Constant.ts 在模块级同步初始化中依赖（sendSync） */
  getPath: (name: string): string => ipcRenderer.sendSync(OsChannels.getPath, name),
  getFileIcon: (filePath: string): Promise<string> =>
    ipcRenderer.invoke(OsChannels.getFileIcon, filePath),
  getCursorScreenPoint: (): Promise<{ x: number; y: number }> =>
    ipcRenderer.invoke(OsChannels.getCursorScreenPoint)
}

// ── display ────────────────────────────────────────────────

const display = {
  getPrimaryDisplay: () => ipcRenderer.invoke(DisplayChannels.getPrimaryDisplay),
  getAllDisplays: () => ipcRenderer.invoke(DisplayChannels.getAllDisplays),
  getDisplayNearestPoint: (point: { x: number; y: number }) =>
    ipcRenderer.invoke(DisplayChannels.getDisplayNearestPoint, point),
  getDisplayMatching: (rect: { x: number; y: number; width: number; height: number }) =>
    ipcRenderer.invoke(DisplayChannels.getDisplayMatching, rect),
  screenToDipPoint: (point: { x: number; y: number }) =>
    ipcRenderer.invoke(DisplayChannels.screenToDipPoint, point),
  dipToScreenPoint: (point: { x: number; y: number }) =>
    ipcRenderer.invoke(DisplayChannels.dipToScreenPoint, point),
  screenToDipRect: (rect: { x: number; y: number; width: number; height: number }) =>
    ipcRenderer.invoke(DisplayChannels.screenToDipRect, rect),
  dipToScreenRect: (rect: { x: number; y: number; width: number; height: number }) =>
    ipcRenderer.invoke(DisplayChannels.dipToScreenRect, rect),
  desktopCaptureSources: (options: {
    types: string[]
    thumbnailSize?: { width: number; height: number }
    fetchWindowIcons?: boolean
  }) => ipcRenderer.invoke(DisplayChannels.desktopCaptureSources, options)
}

// ── notification ───────────────────────────────────────────

const notification = {
  show: (body: string): void => {
    ipcRenderer.send(NotificationChannels.show, body)
  }
}

// ── ffmpeg ─────────────────────────────────────────────────

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

const ffmpeg = {
  run: ffmpegRun
}

// ── sharp ──────────────────────────────────────────────────

const sharp = {
  metadata: (input: string | Uint8Array): Promise<Record<string, unknown>> =>
    ipcRenderer.invoke(SharpChannels.metadata, input),
  crop: (
    input: string,
    region: SharpRegion,
    output: string
  ): Promise<{ width?: number; height?: number }> =>
    ipcRenderer.invoke(SharpChannels.crop, input, region, output),
  removeBackground: (
    input: string,
    options: { color?: string | number[]; tolerance?: unknown } | undefined,
    output: string
  ): Promise<{ width: number; height: number; removedPixels: number }> =>
    ipcRenderer.invoke(SharpChannels.removeBackground, input, options, output),
  colorMap: (input: string, gridSize: number, top: number): Promise<SharpColorMapResult> =>
    ipcRenderer.invoke(SharpChannels.colorMap, input, gridSize, top)
}

// ── 对外输出 ───────────────────────────────────────────────

/**
 * 运行浏览器工具（browser_fetch / browser_actions 统一入口）
 *
 * 载荷（fetch/actions 判别联合）直传 main，由 BrowserToolRunner 在主进程内创建隐藏窗口执行。
 * error 时 reject，resolve 最后一个数据项（fetch 为提取的内容，actions 为最后一个 evaluate 类结果）。
 */
const runBrowser = async (payload: BrowserToolPayload): Promise<unknown> => {
  const result = (await ipcRenderer.invoke(BrowserToolChannels.run, payload)) as BrowserToolResult
  if (result?.error) {
    throw new Error(result.message || 'browserTool run failed')
  }
  const data = result?.data
  return Array.isArray(data) ? data[data.length - 1] : undefined
}

export const injectApi = {
  shell,
  dialog,
  clipboard,
  os,
  display,
  notification,

  /** 浏览器工具统一入口：fetch（抓取网页内容）/ actions（自动化操作步骤） */
  runBrowser,

  ffmpeg,
  sharp
}
