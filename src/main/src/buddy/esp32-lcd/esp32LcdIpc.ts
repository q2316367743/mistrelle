/**
 * ESP32 LCD IPC handler（main 进程）：配置读写 + 连接编排 + 运行态。
 * 额度插件是独立公共域（quota:*，见 buddy/quota）；本域经 quotaBus 订阅快照下发串口（init 内）。
 */
import { ipcMain } from 'electron'
import { Esp32LcdChannels } from '@common/buddy/esp32-lcd/esp32LcdChannels'
import type {
  Esp32LcdConfig,
  Esp32LcdSaveResult,
  LcdRuntimeState
} from '@common/types/esp32Lcd'
import {
  connect,
  disconnect,
  getLastEvent,
  getConnectedState,
  getEsp32LcdConfig,
  saveEsp32LcdConfig
} from './esp32LcdService'

export function registerEsp32LcdIpc(): void {
  ipcMain.handle(Esp32LcdChannels.getConfig, (): Esp32LcdConfig => getEsp32LcdConfig())
  ipcMain.handle(Esp32LcdChannels.saveConfig, (_event, raw: unknown): Esp32LcdSaveResult =>
    saveEsp32LcdConfig(raw)
  )
  ipcMain.handle(
    Esp32LcdChannels.connect,
    (_event, path: string, baudRate?: number): Promise<Esp32LcdSaveResult> =>
      connect(path, baudRate)
  )
  ipcMain.handle(Esp32LcdChannels.disconnect, (): Promise<void> => disconnect())
  ipcMain.handle(Esp32LcdChannels.getState, (): LcdRuntimeState => ({
    ...getConnectedState(),
    lastEvent: getLastEvent()
  }))
}
