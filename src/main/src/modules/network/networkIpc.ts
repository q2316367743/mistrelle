/**
 * network IPC handler（main 进程）：网络设置读写。
 * 设置数据家在 main（内存缓存 + 写时刷新，保存即生效），渲染层设置页经此通道读写。
 */
import { ipcMain } from 'electron'
import { NetworkChannels } from '~/modules/network/networkChannels'
import { loadNetworkSetting, saveNetworkSetting } from './networkSetting'
import type { SettingNetwork } from '@common/types/networkSetting'

export function registerNetworkIpc(): void {
  ipcMain.handle(NetworkChannels.getSetting, () => loadNetworkSetting())
  ipcMain.handle(NetworkChannels.saveSetting, (_event, setting: SettingNetwork) =>
    saveNetworkSetting(setting)
  )
}
