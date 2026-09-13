/**
 * window.preload.updater 契约：应用自动更新桥。
 */
declare type UpdaterStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'

declare type UpdaterMode = 'builtin' | 'external'

declare interface UpdaterState {
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

declare interface UpdaterApi {
  getState(): Promise<UpdaterState>
  check(): Promise<UpdaterState>
  download(): Promise<UpdaterState>
  quitAndInstall(): Promise<void>
  onChanged(callback: (state: UpdaterState) => void): () => void
}
