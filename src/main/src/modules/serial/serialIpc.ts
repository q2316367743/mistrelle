/**
 * 串口通信 IPC handler（main 进程）：serial 域透传 SerialService。
 */
import { ipcMain } from 'electron'
import { SerialChannels, type SerialPortItem, type SerialState } from '~/modules/serial/serialChannels'
import { closePort, getState, listPorts, openPort, writePort } from './SerialService'

export function registerSerialIpc(): void {
  ipcMain.handle(SerialChannels.list, (): Promise<SerialPortItem[]> => listPorts())
  ipcMain.handle(
    SerialChannels.open,
    (_event, path: string, baudRate?: number): Promise<void> => openPort(path, baudRate)
  )
  ipcMain.handle(SerialChannels.write, (_event, data: string): Promise<void> => writePort(data))
  ipcMain.handle(SerialChannels.close, (): Promise<void> => closePort())
  ipcMain.handle(SerialChannels.getState, (): SerialState => getState())
}
