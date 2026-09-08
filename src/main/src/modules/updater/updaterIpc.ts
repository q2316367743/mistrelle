/**
 * 应用自动更新 IPC handler：透传 UpdaterService。
 */
import { ipcMain } from 'electron'
import { UpdaterChannels, type UpdaterState } from '~/modules/updater/updaterChannels'
import {
  checkForAppUpdates,
  currentUpdaterState,
  downloadAppUpdate,
  quitAndInstallUpdate,
} from './UpdaterService'

export function registerUpdaterIpc(): void {
  ipcMain.handle(UpdaterChannels.getState, (): UpdaterState => currentUpdaterState())
  ipcMain.handle(UpdaterChannels.check, (): Promise<UpdaterState> => checkForAppUpdates())
  ipcMain.handle(UpdaterChannels.download, (): Promise<UpdaterState> => downloadAppUpdate())
  ipcMain.handle(UpdaterChannels.quitAndInstall, (): void => quitAndInstallUpdate())
}
