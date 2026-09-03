/**
 * 串口通信桥（preload）：serial 域的 IPC 薄封装 + 推送订阅。
 * 端口实例与连接状态在 main（SerialService 单例），渲染层只调用类型化方法并订阅断开/数据推送。
 */
import { ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { SerialChannels, type SerialPortItem, type SerialState } from './serialChannels'

export const serialApi = {
  /** 串口设备列表 */
  list: (): Promise<SerialPortItem[]> => ipcRenderer.invoke(SerialChannels.list),
  /** 打开串口（已开则先关旧的）；默认 9600 与 Arduino 端一致 */
  open: (path: string, baudRate?: number): Promise<void> =>
    ipcRenderer.invoke(SerialChannels.open, path, baudRate),
  /** 写入文本（utf8）；未连接时 reject */
  write: (data: string): Promise<void> => ipcRenderer.invoke(SerialChannels.write, data),
  /** 关闭串口（幂等） */
  close: (): Promise<void> => ipcRenderer.invoke(SerialChannels.close),
  /** 当前连接状态快照 */
  getState: (): Promise<SerialState> => ipcRenderer.invoke(SerialChannels.getState),
  /** 订阅串口数据推送（utf8 文本原样）；返回取消订阅函数 */
  onData: (callback: (chunk: string) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, chunk: string): void => callback(chunk)
    ipcRenderer.on(SerialChannels.data, listener)
    return () => {
      ipcRenderer.removeListener(SerialChannels.data, listener)
    }
  },
  /** 订阅连接意外断开推送；返回取消订阅函数 */
  onClosed: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on(SerialChannels.closed, listener)
    return () => {
      ipcRenderer.removeListener(SerialChannels.closed, listener)
    }
  }
}

export type SerialApi = typeof serialApi
