/**
 * 小键盘 IPC handler（main 进程）：配置读取 + 绑定保存 + 连接编排 + 运行态。
 * 按键解析与模拟按键不走 IPC（init 内订阅串口行，见 keypadService）；
 * 设备为单向输入，无指令发送通道。
 */
import { ipcMain } from 'electron'
import { KeypadChannels } from '@common/buddy/keypad/keypadChannels'
import type { KeypadConfig, KeypadResult, KeypadState } from '@common/types/keypad'
import { connect, disconnect, getConfig, getState, saveBindings } from './keypadService'

export function registerKeypadIpc(): void {
  ipcMain.handle(KeypadChannels.getConfig, (): KeypadConfig => getConfig())
  ipcMain.handle(
    KeypadChannels.saveBindings,
    (_event, input: Record<string, unknown>): KeypadResult => saveBindings(input)
  )
  ipcMain.handle(KeypadChannels.connect, (_event, path: string): Promise<KeypadResult> =>
    connect(path)
  )
  ipcMain.handle(KeypadChannels.disconnect, (): Promise<void> => disconnect())
  ipcMain.handle(KeypadChannels.getState, (): KeypadState => getState())
}
