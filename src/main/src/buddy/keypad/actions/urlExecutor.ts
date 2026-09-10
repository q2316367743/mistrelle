/**
 * 「打开网页」动作执行器：仅在设备按下（on）时触发。
 * shell.openExternal 交系统默认浏览器打开；无效网址时 Promise reject，
 * 由序列执行器（runSequence）统一捕获记日志，不影响后续动作。
 */
import { shell } from 'electron'
import type { KeypadUrlAction } from '@common/types/keypad'
import type { KeypadActionExecutor } from './index'

export const urlExecutor: KeypadActionExecutor<KeypadUrlAction> = {
  onPress: (action) => shell.openExternal(action.url)
}
