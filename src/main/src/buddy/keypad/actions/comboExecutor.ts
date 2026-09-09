/**
 * 「模拟按键」动作执行器：按下按住组合、释放抬起组合（push-to-talk），
 * 组合引用计数与防修饰键卡死由 keySimulator 保证。
 */
import type { KeypadComboAction } from '@common/types/keypad'
import { pressCombo, releaseCombo } from '../keySimulator'
import type { KeypadActionExecutor } from './index'

export const comboExecutor: KeypadActionExecutor<KeypadComboAction> = {
  onPress: (action) => pressCombo(action),
  onRelease: (action) => releaseCombo(action)
}
