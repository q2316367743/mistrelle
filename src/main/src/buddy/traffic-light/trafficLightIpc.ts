/**
 * 红绿灯 IPC handler（main 进程）：配置读取 / 单软件配置保存 / lastPort 记忆。
 * 事件入口 applyEvent 不走 IPC（main 内部由事件接入方直接调用）。
 */
import { ipcMain } from 'electron'
import {
  TrafficLightChannels,
  type SoftwareLightConfig,
  type SoftwareName,
  type TrafficLightConfig,
  type TrafficLightSaveResult
} from '~/modules/traffic-light/trafficLightChannels'
import { getConfig, saveSoftwareConfig, setLastPort } from './TrafficLightService'

export function registerTrafficLightIpc(): void {
  ipcMain.handle(TrafficLightChannels.getConfig, (): TrafficLightConfig => getConfig())
  ipcMain.handle(
    TrafficLightChannels.saveSoftwareConfig,
    (_event, software: SoftwareName, input: SoftwareLightConfig): TrafficLightSaveResult =>
      saveSoftwareConfig(software, input)
  )
  ipcMain.handle(TrafficLightChannels.setLastPort, (_event, path: string): void => setLastPort(path))
}
