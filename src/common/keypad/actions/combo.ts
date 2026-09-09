/**
 * 「模拟按键」动作定义：修饰键组合 + 白名单主键。
 * 按下即按住组合、释放即抬起（push-to-talk）；归一化沿用主键/修饰键白名单清洗。
 */
import {
  isKeypadKeyName,
  isKeypadModifier,
  type KeypadComboAction,
  type KeypadModifier
} from '../../types/keypad'
import type { KeypadActionDefinition } from './index'

export const comboAction: KeypadActionDefinition<KeypadComboAction> = {
  type: 'combo',
  label: '模拟按键',
  normalize(raw) {
    if (typeof raw.key !== 'string' || !isKeypadKeyName(raw.key)) return null
    const modifiers: KeypadModifier[] = []
    if (Array.isArray(raw.modifiers)) {
      for (const item of raw.modifiers) {
        if (typeof item === 'string' && isKeypadModifier(item) && !modifiers.includes(item)) {
          modifiers.push(item)
        }
      }
    }
    return { type: 'combo', modifiers, key: raw.key }
  },
  createDefault() {
    // 默认主键取 F13：几乎无系统占用，适合作为录制前的占位组合
    return { type: 'combo', modifiers: [], key: 'f13' }
  }
}
