/**
 * 「模拟按键」动作执行器：模拟一次完整击键——按下组合、短暂按住后自动抬起
 * （动作序列化后 combo 在序列中是瞬时动作，物理松开键位不再参与抬起时机）。
 */
import type { KeypadComboAction } from '@common/types/keypad'
import { pressCombo, releaseCombo } from '../keySimulator'
import type { KeypadActionExecutor } from './index'

/** 击键按住时长：模拟真实按键节奏，过短部分应用收不到 */
const COMBO_TAP_HOLD_MS = 60

export const comboExecutor: KeypadActionExecutor<KeypadComboAction> = {
  onPress: (action) => {
    pressCombo(action)
    setTimeout(() => releaseCombo(action), COMBO_TAP_HOLD_MS)
  }
}
