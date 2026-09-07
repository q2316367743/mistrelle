/**
 * 串口通信桥（preload）：serial 域 IPC 薄封装。
 * 只承载系统级只读查询（设备列表）；连接/写入等操作走各业务域（trafficLight/esp32Lcd）桥。
 */
import { ipcRenderer } from 'electron'
import { SerialChannels, type SerialPortItem } from './serialChannels'

export const serialApi = {
  /** 串口设备列表 */
  list: (): Promise<SerialPortItem[]> => ipcRenderer.invoke(SerialChannels.list)
}

export type SerialApi = typeof serialApi
