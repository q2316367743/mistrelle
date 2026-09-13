/**
 * 应用自动更新域通道常量与类型（preload 桥与 main handler 共用）。
 */
export const UpdaterChannels = {
  getState: 'updater:getState',
  check: 'updater:check',
  download: 'updater:download',
  quitAndInstall: 'updater:quitAndInstall',
  changed: 'updater:changed',
} as const

export type UpdaterStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'

/** 更新方式：builtin 走 electron-updater 应用内下载安装；external 打开服务端下发的网盘链接。 */
export type UpdaterMode = 'builtin' | 'external'

export interface UpdaterState {
  status: UpdaterStatus
  mode: UpdaterMode
  currentVersion: string
  availableVersion: string | null
  releaseNotes: string | null
  /** 仅 mode=external 时有值。 */
  downloadUrl: string | null
  percent: number
  error: string | null
}
