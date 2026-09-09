/**
 * 「执行脚本」动作执行器：仅在设备按下（on）时触发，主进程 cliRun 执行任意 shell 命令
 * （login PATH 兜底、超时 kill、永不 reject）。fire-and-forget，失败只记日志。
 */
import type { KeypadScriptAction } from '@common/types/keypad'
import { cliRun } from '$/modules/shell/shellExec'
import type { KeypadActionExecutor } from './index'

export const scriptExecutor: KeypadActionExecutor<KeypadScriptAction> = {
  onPress: (action) => {
    void cliRun(action.command, [], { timeout: 60_000 }).then((result) => {
      if (result.error) console.error('[keypad] 脚本执行失败', action.command, result.error)
    })
  }
}
