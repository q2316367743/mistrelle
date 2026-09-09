/**
 * 「执行脚本」动作定义：任意 shell 命令串（主进程 cliRun 执行，login PATH 兜底）。
 * 命令非空即合法（空命令无法执行，归一化丢弃）。
 */
import type { KeypadScriptAction } from '../../types/keypad'
import type { KeypadActionDefinition } from './index'

export const scriptAction: KeypadActionDefinition<KeypadScriptAction> = {
  type: 'script',
  label: '执行脚本',
  normalize(raw) {
    if (typeof raw.command !== 'string') return null
    const command = raw.command.trim()
    if (!command) return null
    return { type: 'script', command }
  },
  createDefault() {
    return { type: 'script', command: '' }
  }
}
