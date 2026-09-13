/**
 * 桌面客户端自动更新（electron-updater generic provider）。
 * 未打包环境不发请求；autoDownload=false，由渲染层确认后再下载/安装。
 * 检查更新先走服务端 /api/updates/latest：网盘模式（external）在这里直接下发链接，
 * 内置模式（builtin）继续走 electron-updater 的 latest.yml feed。
 */
import { app, BrowserWindow } from 'electron'
import { autoUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater'
import { UpdaterChannels, type UpdaterMode, type UpdaterState } from '~/modules/updater/updaterChannels'
import { getServerBaseUrl } from '../auth/AuthService'

const CHECK_TIMEOUT_MS = 15_000

/** 服务端 /api/updates/latest 的 data 部分。 */
interface RemoteLatest {
  version: string
  releaseNotes: string | null
  mode: UpdaterMode
  downloadUrl: string | null
}

let state: UpdaterState = {
  status: 'idle',
  mode: 'builtin',
  currentVersion: app.getVersion(),
  availableVersion: null,
  releaseNotes: null,
  downloadUrl: null,
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

/** 仅支持 x.y.z 数值比较，与服务端 semver 口径一致。 */
function compareVersion(a: string, b: string): number {
  const pa = a.split('.').map((part) => Number.parseInt(part, 10) || 0)
  const pb = b.split('.').map((part) => Number.parseInt(part, 10) || 0)
  const n = Math.max(pa.length, pb.length)
  for (let i = 0; i < n; i++) {
    const da = pa[i] ?? 0
    const db = pb[i] ?? 0
    if (da !== db) return da < db ? -1 : 1
  }
  return 0
}

/**
 * 请求服务端轻量检查更新接口（公开，无鉴权）。
 * 拉取失败 / 404（暂无已发布版本）/ 报文异常一律返回 null，调用方回退 electron-updater feed。
 */
async function fetchLatestUpdate(): Promise<RemoteLatest | null> {
  const response = await fetch(`${getServerBaseUrl()}/api/updates/latest`, {
    signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
  })
  if (!response.ok) return null
  const body: unknown = await response.json()
  if (typeof body !== 'object' || body === null || !('data' in body)) return null
  const data: unknown = body.data
  if (typeof data !== 'object' || data === null || !('version' in data) || !('mode' in data)) {
    return null
  }
  const { version, mode } = data
  if (typeof version !== 'string' || (mode !== 'builtin' && mode !== 'external')) return null
  const releaseNotes: unknown = 'releaseNotes' in data ? data.releaseNotes : null
  const downloadUrl: unknown = 'downloadUrl' in data ? data.downloadUrl : null
  return {
    version,
    mode,
    releaseNotes: typeof releaseNotes === 'string' && releaseNotes ? releaseNotes : null,
    downloadUrl: typeof downloadUrl === 'string' && downloadUrl ? downloadUrl : null,
  }
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
      mode: 'builtin',
      availableVersion: info.version,
      releaseNotes: notesOf(info),
      downloadUrl: null,
      percent: 0,
      error: null,
    })
  })
  autoUpdater.on('update-not-available', () => {
    patch({
      status: 'idle',
      mode: 'builtin',
      availableVersion: null,
      releaseNotes: null,
      downloadUrl: null,
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
      mode: 'builtin',
      availableVersion: info.version,
      releaseNotes: notesOf(info),
      downloadUrl: null,
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
  patch({ status: 'checking', error: null })
  // 网盘模式版本没有平台文件，不会出现在 electron-updater 的 feed 里，必须在这里拦截
  const remote = await fetchLatestUpdate().catch(() => null)
  if (remote?.mode === 'external') {
    if (compareVersion(remote.version, app.getVersion()) > 0 && remote.downloadUrl) {
      patch({
        status: 'available',
        mode: 'external',
        availableVersion: remote.version,
        releaseNotes: remote.releaseNotes,
        downloadUrl: remote.downloadUrl,
        percent: 0,
        error: null,
      })
      return snapshot()
    }
    patch({
      status: 'idle',
      mode: 'builtin',
      availableVersion: null,
      releaseNotes: null,
      downloadUrl: null,
      percent: 0,
      error: null,
    })
    return snapshot()
  }
  // 内置模式或轻量接口不可用时，维持 electron-updater feed 流程
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
