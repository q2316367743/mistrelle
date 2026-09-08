/**
 * 应用自动更新桥（preload）：updater 域的 IPC 薄封装 + 状态订阅。
 */
import { ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { UpdaterChannels, type UpdaterState } from './updaterChannels'

export const updaterApi = {
  getState: (): Promise<UpdaterState> => ipcRenderer.invoke(UpdaterChannels.getState),
  check: (): Promise<UpdaterState> => ipcRenderer.invoke(UpdaterChannels.check),
  download: (): Promise<UpdaterState> => ipcRenderer.invoke(UpdaterChannels.download),
  quitAndInstall: (): Promise<void> => ipcRenderer.invoke(UpdaterChannels.quitAndInstall),
  onChanged: (callback: (state: UpdaterState) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, state: UpdaterState): void => callback(state)
    ipcRenderer.on(UpdaterChannels.changed, listener)
    return () => {
      ipcRenderer.removeListener(UpdaterChannels.changed, listener)
    }
  },
}
