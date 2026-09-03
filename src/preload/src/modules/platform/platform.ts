/**
 * platform 桥（preload）：Electron/OS 原生能力六域的 IPC 薄封装（原 inject.ts 的平台段）。
 * 实现位于 main（modules/platform/electronIpc.ts）；挂载于 window.preload.inject 下。
 * 设计约定：除 os.getPath 外全部异步（ipcRenderer.invoke）；getPath 因 Constant.ts 模块级同步初始化保留 sendSync。
 */
import { ipcRenderer } from 'electron'
import {
  ShellChannels,
  DialogChannels,
  DialogOpenOptions,
  DialogSaveOptions,
  ClipboardChannels,
  OsChannels,
  DisplayChannels,
  NotificationChannels
} from './platformChannels'

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
  copyImageByPath: (path: string): Promise<boolean> =>
    ipcRenderer.invoke(ClipboardChannels.copyImageByPath, path),
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

export const platformApi = {
  shell,
  dialog,
  clipboard,
  os,
  display,
  notification
}
