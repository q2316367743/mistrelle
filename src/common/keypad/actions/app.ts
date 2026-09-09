/**
 * 「打开应用」动作定义：应用绝对路径（本机应用目录选择或自定义路径手输）。
 * 路径非空即合法（执行侧对存在路径走 shell.openPath、名称走平台 shell 兜底）。
 */
import type { KeypadAppAction } from '../../types/keypad'
import type { KeypadActionDefinition } from './index'

export const appAction: KeypadActionDefinition<KeypadAppAction> = {
  type: 'app',
  label: '打开应用',
  normalize(raw) {
    if (typeof raw.path !== 'string') return null
    const path = raw.path.trim()
    if (!path) return null
    return { type: 'app', path }
  },
  createDefault() {
    return { type: 'app', path: '' }
  }
}
