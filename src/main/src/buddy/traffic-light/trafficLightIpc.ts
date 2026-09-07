/**
 * 红绿灯 IPC handler（main 进程）：配置读写 + 连接编排 + 指令发送。
 * 事件消费不走 IPC（init 内经 buddyEventBus 订阅，见 TrafficLightService）；
 * 接入配置检查与安装已迁应用集成域（buddy/integrations）。
 */
import { ipcMain } from 'electron'
import { TrafficLightChannels } from '@common/buddy/traffic-light/trafficLightChannels'
import type {
  SoftwareLightConfig,
  SoftwareName,
  TrafficLightConfig,
  TrafficLightSaveResult,
  TrafficLightState
} from '@common/types/trafficLight'
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
    TrafficLightChannels.connect,
    (_event, path: string): Promise<TrafficLightSaveResult> => connect(path)
  )
  ipcMain.handle(TrafficLightChannels.disconnect, (): Promise<void> => disconnect())
  ipcMain.handle(TrafficLightChannels.sendCommand, (_event, code: string): Promise<void> =>
    sendCommand(code)
  )
  ipcMain.handle(TrafficLightChannels.getState, (): TrafficLightState => getState())
}
