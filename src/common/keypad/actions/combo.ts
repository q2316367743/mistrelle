/**
 * 「模拟按键」动作定义：修饰键组合 + 白名单主键（普通键或媒体键）。
 * 按住语义由序列执行方决定（短按=完整击键、长按单条=保持按住）；
 * 归一化沿用主键/修饰键白名单清洗，媒体键强制清空修饰键（音量键没有组合语义）。
 */
import {
  isKeypadKeyName,
  isKeypadMediaKeyName,
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
    // 媒体键（音量/亮度/播放）无组合语义，修饰键直接丢弃
    if (!isKeypadMediaKeyName(raw.key) && Array.isArray(raw.modifiers)) {
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
