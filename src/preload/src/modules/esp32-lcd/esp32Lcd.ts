/**
 * ESP32 LCD 桥（preload）：esp32-lcd 域的 IPC 薄封装 + 推送订阅。
 * 配置读写、连接编排、事件转发都在 main（esp32LcdService 单例），渲染层只调用类型化方法。
 * 额度快照属公共 quota 域（window.preload.quota），不在本域。
 */
import { ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { Esp32LcdChannels } from '@common/buddy/esp32-lcd/esp32LcdChannels'
import type {
  BuddyEventState,
  Esp32LcdConfig,
  Esp32LcdSaveResult,
  LcdConnectedState,
  LcdRuntimeState
} from '@common/types/esp32Lcd'

export const esp32LcdApi = {
  /** 读取整份配置 */
  getConfig: (): Promise<Esp32LcdConfig> => ipcRenderer.invoke(Esp32LcdChannels.getConfig),
  /** 保存整份配置（main 归一化后落盘） */
  saveConfig: (config: Esp32LcdConfig): Promise<Esp32LcdSaveResult> =>
    ipcRenderer.invoke(Esp32LcdChannels.saveConfig, config),
  /** 连接串口（成功即记忆 lastPort/baudRate 并广播运行态） */
  connect: (path: string, baudRate?: number): Promise<Esp32LcdSaveResult> =>
    ipcRenderer.invoke(Esp32LcdChannels.connect, path, baudRate),
  /** 断开当前连接 */
  disconnect: (): Promise<void> => ipcRenderer.invoke(Esp32LcdChannels.disconnect),
  /** 读取完整运行态（连接 + 最近事件） */
  getState: (): Promise<LcdRuntimeState> => ipcRenderer.invoke(Esp32LcdChannels.getState),
  /** 订阅当前事件变化推送；返回取消订阅函数 */
  onEvent: (callback: (state: BuddyEventState) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, state: BuddyEventState): void => callback(state)
    ipcRenderer.on(Esp32LcdChannels.event, listener)
    return () => {
      ipcRenderer.removeListener(Esp32LcdChannels.event, listener)
    }
  },
  /** 订阅连接运行态变化推送；返回取消订阅函数 */
  onState: (callback: (state: LcdConnectedState) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, state: LcdConnectedState): void => callback(state)
    ipcRenderer.on(Esp32LcdChannels.state, listener)
    return () => {
      ipcRenderer.removeListener(Esp32LcdChannels.state, listener)
    }
  }
}

export type Esp32LcdPreloadApi = typeof esp32LcdApi
