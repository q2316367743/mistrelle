/**
 * 红绿灯 IPC handler（main 进程）：配置读取 / 单软件配置保存 / lastPort 记忆 / 接入配置检查与安装。
 * 事件入口 applyEvent 不走 IPC（main 内部由事件接入方直接调用）。
 */
import { ipcMain } from 'electron'
import {
  TrafficLightChannels,
  type PlatformInstallResult,
  type PlatformStatus,
  type SoftwareLightConfig,
  type SoftwareName,
  type TrafficLightConfig,
  type TrafficLightSaveResult
} from '@common/buddy/traffic-light/trafficLightChannels'
import { checkPlatform, installPlatform } from './platformConfig'
import { getConfig, saveSoftwareConfig, setLastPort } from './TrafficLightService'

export function registerTrafficLightIpc(): void {
  ipcMain.handle(TrafficLightChannels.getConfig, (): TrafficLightConfig => getConfig())
  ipcMain.handle(
    TrafficLightChannels.saveSoftwareConfig,
    (_event, software: SoftwareName, input: SoftwareLightConfig): TrafficLightSaveResult =>
      saveSoftwareConfig(software, input)
  )
  ipcMain.handle(TrafficLightChannels.setLastPort, (_event, path: string): void => setLastPort(path))
  ipcMain.handle(
    TrafficLightChannels.checkPlatform,
    (_event, software: string): PlatformStatus => checkPlatform(software)
  )
  ipcMain.handle(
    TrafficLightChannels.installPlatform,
    (_event, software: string): PlatformInstallResult => installPlatform(software)
  )
}
