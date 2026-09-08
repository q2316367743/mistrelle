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

export interface UpdaterState {
  status: UpdaterStatus
  currentVersion: string
  availableVersion: string | null
  releaseNotes: string | null
  percent: number
  error: string | null
}
