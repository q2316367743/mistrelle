/**
 * 串口通信 IPC handler（main 进程）：只透传系统级只读查询（设备列表）。
 * 连接/写入/断开由各业务域服务编排（经各自域 IPC），不经本域。
 */
import { ipcMain } from 'electron'
import { SerialChannels, type SerialPortItem } from '~/modules/serial/serialChannels'
import { listPorts } from './SerialService'

export function registerSerialIpc(): void {
  ipcMain.handle(SerialChannels.list, (): Promise<SerialPortItem[]> => listPorts())
}
