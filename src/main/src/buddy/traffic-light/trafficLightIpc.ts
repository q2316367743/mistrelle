/**
 * 红绿灯 IPC handler（main 进程）：配置读写 + 连接编排 + 指令发送 + 接入配置检查与安装。
 * 事件消费不走 IPC（init 内经 buddyEventBus 订阅，见 TrafficLightService）。
 */
import { ipcMain } from 'electron'
import { TrafficLightChannels } from '@common/buddy/traffic-light/trafficLightChannels'
import type {
  PlatformInstallResult,
  PlatformStatus,
  SoftwareLightConfig,
  SoftwareName,
  TrafficLightConfig,
  TrafficLightSaveResult,
  TrafficLightState
} from '@common/types/trafficLight'
import { checkPlatform, installPlatform } from './platformConfig'
import {
  connect,
  disconnect,
  getConfig,
  getState,
  saveSoftwareConfig,
  sendCommand,
  setLastPort
} from './TrafficLightService'

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
  ipcMain.handle(
    TrafficLightChannels.connect,
    (_event, path: string): Promise<TrafficLightSaveResult> => connect(path)
  )
  ipcMain.handle(TrafficLightChannels.disconnect, (): Promise<void> => disconnect())
  ipcMain.handle(TrafficLightChannels.sendCommand, (_event, code: string): Promise<void> =>
    sendCommand(code)
  )
  ipcMain.handle(TrafficLightChannels.getState, (): TrafficLightState => getState())
}
