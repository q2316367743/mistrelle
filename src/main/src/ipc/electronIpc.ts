/**
 * Electron 平台能力 IPC handler：shell / dialog / clipboard / os / display / notification。
 * 原 src-utools/src/inject.js 中对应模块的 Electron 等价实现。
 *
 * 注意：os.getPath 使用 sendSync（renderer 的 Constant.ts 在模块级同步初始化中依赖）。
 */
import {
  ipcMain,
  shell,
  dialog,
  clipboard,
  app,
  nativeTheme,
  screen,
  desktopCapturer,
  Notification,
  BrowserWindow,
  type IpcMainEvent
} from 'electron'
import { basename, join } from 'node:path'
import { homedir } from 'node:os'
import { statSync } from 'node:fs'
import {
  ShellChannels,
  DialogChannels,
  DialogOpenOptions,
  DialogSaveOptions,
  ClipboardChannels,
  OsChannels,
  DisplayChannels,
  NotificationChannels
} from '~/channels'

// ── shell ──────────────────────────────────────────────────

export function registerShellIpc(): void {
  ipcMain.handle(ShellChannels.openExternal, (_event, url: string): void => {
    void shell.openExternal(url)
  })
  ipcMain.handle(ShellChannels.openPath, async (_event, fullPath: string): Promise<void> => {
    await shell.openPath(fullPath)
  })
  ipcMain.handle(ShellChannels.trashItem, (_event, filename: string): Promise<void> =>
    shell.trashItem(filename)
  )
  ipcMain.handle(ShellChannels.showItemInFolder, (_event, fullPath: string): void => {
    shell.showItemInFolder(fullPath)
  })
  ipcMain.handle(ShellChannels.beep, (): void => {
    shell.beep()
  })
}

// ── dialog ─────────────────────────────────────────────────
// 异步 invoke（renderer 调用点已 await 化）

export function registerDialogIpc(): void {
  ipcMain.handle(
    DialogChannels.open,
    async (event, options: DialogOpenOptions): Promise<string[] | undefined> => {
      const win = BrowserWindow.fromWebContents(event.sender)
      const dialogOptions = {
        title: options.title,
        defaultPath: options.defaultPath,
        buttonLabel: options.buttonLabel,
        filters: options.filters,
        properties: options.properties as Array<
          | 'openFile'
          | 'openDirectory'
          | 'multiSelections'
          | 'showHiddenFiles'
          | 'createDirectory'
          | 'promptToCreate'
          | 'noResolveAliases'
          | 'treatPackageAsDirectory'
          | 'dontAddToRecent'
        >,
        message: options.message
      }
      const { canceled, filePaths } = win
        ? await dialog.showOpenDialog(win, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions)
      return canceled ? undefined : filePaths
    }
  )

  ipcMain.handle(
    DialogChannels.save,
    async (event, options: DialogSaveOptions): Promise<string | undefined> => {
      const win = BrowserWindow.fromWebContents(event.sender)
      const dialogOptions = {
        title: options.title,
        defaultPath: options.defaultPath,
        buttonLabel: options.buttonLabel,
        filters: options.filters,
        message: options.message,
        nameFieldLabel: options.nameFieldLabel,
        properties: options.properties as Array<
          'showHiddenFiles' | 'createDirectory' | 'treatPackageAsDirectory' | 'showOverwriteConfirmation' | 'dontAddToRecent'
        >
      }
      const { canceled, filePath } = win
        ? await dialog.showSaveDialog(win, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions)
      return canceled ? undefined : filePath
    }
  )
}

// ── clipboard ──────────────────────────────────────────────
// 异步 invoke（renderer 调用点已 await 化）

/** 文件剪贴板格式名（平台私有） */
const FILE_FORMAT = process.platform === 'win32' ? 'FileNameW' : 'public.file-url'

/** 解析剪贴板文件列表，返回路径数组 */
const parseClipboardFiles = (): string[] => {
  const buf = clipboard.readBuffer(FILE_FORMAT)
  if (!buf || buf.length === 0) return []
  if (process.platform === 'win32') {
    // UTF-16LE，NUL 分隔
    return buf.toString('utf16le').split('\0').filter(Boolean)
  }
  if (process.platform === 'darwin') {
    // file:// URL 换行分隔
    return buf
      .toString('utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return decodeURIComponent(line.replace(/^file:\/\//, ''))
        } catch {
          return line.replace(/^file:\/\//, '')
        }
      })
  }
  return []
}

export function registerClipboardIpc(): void {
  ipcMain.handle(ClipboardChannels.copyText, (_event, text: string): boolean => {
    clipboard.writeText(text)
    return true
  })

  ipcMain.handle(ClipboardChannels.copyFile, (_event, file: string | string[]): boolean => {
    const files = Array.isArray(file) ? file : [file]
    if (process.platform === 'win32') {
      clipboard.writeBuffer('FileNameW', Buffer.from(files.join('\0'), 'utf16le'))
      clipboard.writeBuffer('FileName', Buffer.from(files.join('\0'), 'latin1'))
    } else if (process.platform === 'darwin') {
      const urls = files.map((f) => `file://${encodeURI(f)}`).join('\n')
      clipboard.writeBuffer('public.file-url', Buffer.from(urls, 'utf8'))
    } else {
      clipboard.writeText(files.join('\n'))
    }
    return true
  })

  ipcMain.handle(ClipboardChannels.copyImage, (_event, img: string | Uint8Array): boolean => {
    const { nativeImage } = require('electron') as typeof import('electron')
    const imageObj =
      typeof img === 'string'
        ? img.startsWith('data:')
          ? nativeImage.createFromDataURL(img)
          : nativeImage.createFromBuffer(Buffer.from(img, 'base64'))
        : nativeImage.createFromBuffer(Buffer.from(img))
    if (imageObj.isEmpty()) return false
    clipboard.writeImage(imageObj)
    return true
  })

  ipcMain.handle(ClipboardChannels.getCopyedFiles, () => {
    const files = parseClipboardFiles()
    return files.map((path) => {
      let isDirectory = false
      try {
        isDirectory = statSync(path).isDirectory()
      } catch {
        // 文件不存在：按文件处理
      }
      return { isFile: !isDirectory, isDirectory, name: basename(path), path }
    })
  })
}

// ── os ─────────────────────────────────────────────────────

/** utools getPath 名称 → Electron 路径；pepperFlashSystemPlugin 无对应返回 '' */
const resolveOsPath = (name: string): string => {
  if (name === 'pepperFlashSystemPlugin') return ''
  if (name === 'cache') {
    // Electron 39 已移除 app.getPath('cache')，手动推导平台缓存目录
    return process.platform === 'darwin'
      ? join(homedir(), 'Library', 'Caches', app.getName())
      : join(app.getPath('userData'), 'Cache')
  }
  // 非法名称由 app.getPath 抛错（与 utools 行为一致）
  return app.getPath(name as Parameters<typeof app.getPath>[0])
}

export function registerOsIpc(): void {
  ipcMain.handle(OsChannels.isDarkColors, (): boolean => nativeTheme.shouldUseDarkColors)
  ipcMain.handle(OsChannels.isDev, (): boolean => !app.isPackaged)
  ipcMain.handle(OsChannels.getNativeId, () => null)
  ipcMain.handle(OsChannels.getAppVersion, (): string => app.getVersion())
  ipcMain.handle(OsChannels.getAppName, (): string => app.getName())

  // sendSync：Constant.ts 在模块级同步初始化中调用 getPath('appData'/'home')
  ipcMain.on(OsChannels.getPath, (event: IpcMainEvent, name: string): void => {
    event.returnValue = resolveOsPath(name)
  })

  ipcMain.handle(OsChannels.getFileIcon, async (_event, filePath: string): Promise<string> => {
    try {
      const icon = await app.getFileIcon(filePath)
      return icon.toDataURL()
    } catch {
      return ''
    }
  })

  ipcMain.handle(OsChannels.getCursorScreenPoint, () => screen.getCursorScreenPoint())
}

// ── display ────────────────────────────────────────────────

export function registerDisplayIpc(): void {
  ipcMain.handle(DisplayChannels.getPrimaryDisplay, () => screen.getPrimaryDisplay())
  ipcMain.handle(DisplayChannels.getAllDisplays, () => screen.getAllDisplays())
  ipcMain.handle(DisplayChannels.getDisplayNearestPoint, (_event, point) =>
    screen.getDisplayNearestPoint(point)
  )
  ipcMain.handle(DisplayChannels.getDisplayMatching, (_event, rect) =>
    screen.getDisplayMatching(rect)
  )
  ipcMain.handle(DisplayChannels.screenToDipPoint, (_event, point) =>
    screen.screenToDipPoint(point)
  )
  ipcMain.handle(DisplayChannels.dipToScreenPoint, (_event, point) =>
    screen.dipToScreenPoint(point)
  )
  ipcMain.handle(DisplayChannels.screenToDipRect, (_event, rect) =>
    screen.screenToDipRect(null, rect)
  )
  ipcMain.handle(DisplayChannels.dipToScreenRect, (_event, rect) =>
    screen.dipToScreenRect(null, rect)
  )
  ipcMain.handle(DisplayChannels.desktopCaptureSources, async (_event, options) => {
    const sources = await desktopCapturer.getSources(options)
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      display_id: s.display_id,
      thumbnail: s.thumbnail.toDataURL(),
      appIcon: s.appIcon.isEmpty() ? undefined : s.appIcon.toDataURL()
    }))
  })
}

// ── notification ───────────────────────────────────────────

export function registerNotificationIpc(): void {
  ipcMain.on(NotificationChannels.show, (_event, body: string): void => {
    new Notification({ title: app.getName(), body }).show()
  })
}
