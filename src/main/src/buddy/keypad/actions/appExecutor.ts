/**
 * 「打开应用」动作执行器：仅在设备按下（on）时触发。
 * 路径存在走 shell.openPath（.app / .exe / .lnk 都支持）；
 * 否则视为应用名交给平台 shell 兜底（macOS `open -a <名称>`、Windows `start`）。
 */
import { existsSync } from 'fs'
import { shell } from 'electron'
import type { KeypadAppAction } from '@common/types/keypad'
import { cliRun } from '$/modules/shell/shellExec'
import type { KeypadActionExecutor } from './index'

export const appExecutor: KeypadActionExecutor<KeypadAppAction> = {
  onPress: (action) => openApp(action.path)
}

async function openApp(path: string): Promise<void> {
  if (existsSync(path)) {
    const msg = await shell.openPath(path)
    if (msg) console.error('[keypad] 打开应用失败', path, msg)
    return
  }
  // Windows 下 cliRun 的单引号 quote 不被 cmd 识别，start 命令串整条直传
  const result =
    process.platform === 'win32'
      ? await cliRun(`start "" "${path}"`)
      : await cliRun('open', ['-a', path])
  if (result.error) console.error('[keypad] 打开应用失败', path, result.error)
}
