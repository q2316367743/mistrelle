/**
 * 桌面客户端自动更新（electron-updater generic provider）。
 * 未打包环境不发请求；autoDownload=false，由渲染层确认后再下载/安装。
 */
import { app, BrowserWindow } from 'electron'
import { autoUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater'
import { UpdaterChannels, type UpdaterState } from '~/modules/updater/updaterChannels'

let state: UpdaterState = {
  status: 'idle',
  currentVersion: app.getVersion(),
  availableVersion: null,
  releaseNotes: null,
  percent: 0,
  error: null,
}

function broadcast(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(UpdaterChannels.changed, snapshot())
  }
}

function snapshot(): UpdaterState {
  return { ...state }
}

function patch(partial: Partial<UpdaterState>): void {
  state = { ...state, currentVersion: app.getVersion(), ...partial }
  broadcast()
}

function notesOf(info: UpdateInfo): string | null {
  const notes = info.releaseNotes
  if (typeof notes === 'string' && notes.trim()) return notes
  if (Array.isArray(notes)) {
    const text = notes
      .map((item) => (typeof item === 'string' ? item : item.note))
      .filter((item): item is string => Boolean(item))
      .join('\n')
    return text || null
  }
  return null
}

let hooked = false

function ensureHooks(): void {
  if (hooked) return
  hooked = true
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('checking-for-update', () => {
    patch({ status: 'checking', error: null })
  })
  autoUpdater.on('update-available', (info) => {
    patch({
      status: 'available',
      availableVersion: info.version,
      releaseNotes: notesOf(info),
      percent: 0,
      error: null,
    })
  })
  autoUpdater.on('update-not-available', () => {
    patch({
      status: 'idle',
      availableVersion: null,
      releaseNotes: null,
      percent: 0,
      error: null,
    })
  })
  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    patch({ status: 'downloading', percent: progress.percent, error: null })
  })
  autoUpdater.on('update-downloaded', (info) => {
    patch({
      status: 'downloaded',
      availableVersion: info.version,
      releaseNotes: notesOf(info),
      percent: 100,
      error: null,
    })
  })
  autoUpdater.on('error', (error) => {
    patch({ status: 'error', error: error.message || '检查更新失败' })
  })
}

export function currentUpdaterState(): UpdaterState {
  return snapshot()
}

export async function checkForAppUpdates(): Promise<UpdaterState> {
  ensureHooks()
  if (!app.isPackaged) {
    patch({ status: 'idle', error: '当前为开发环境，打包后才会检查更新' })
    return snapshot()
  }
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    patch({
      status: 'error',
      error: error instanceof Error ? error.message : '检查更新失败',
    })
  }
  return snapshot()
}

export async function downloadAppUpdate(): Promise<UpdaterState> {
  ensureHooks()
  if (!app.isPackaged) {
    patch({ status: 'error', error: '当前为开发环境，无法下载更新' })
    return snapshot()
  }
  try {
    await autoUpdater.downloadUpdate()
  } catch (error) {
    patch({
      status: 'error',
      error: error instanceof Error ? error.message : '下载更新失败',
    })
  }
  return snapshot()
}

export function quitAndInstallUpdate(): void {
  autoUpdater.quitAndInstall()
}
