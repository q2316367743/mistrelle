/**
 * 「模拟按键」动作定义：修饰键组合 + 可选白名单主键（普通键或媒体键）。
 * 按住语义由序列执行方决定（短按=完整击键、长按单条=保持按住）；
 * 归一化沿用主键/修饰键白名单清洗，媒体键强制清空修饰键（音量键没有组合语义）。
 * 主键可缺省=只按住修饰键（如按住 Fn 触发输入法语音输入），此时修饰键须非空。
 */
import {
  isKeypadKeyName,
  isKeypadMediaKeyName,
  isKeypadModifier,
  type KeypadComboAction,
  type KeypadKeyName,
  type KeypadModifier
} from '../../types/keypad'
import type { KeypadActionDefinition } from './index'

export const comboAction: KeypadActionDefinition<KeypadComboAction> = {
  type: 'combo',
  label: '模拟按键',
  normalize(raw) {
    // 主键可缺省（只按住修饰键）；一旦给出则必须是白名单内的键
    let key: KeypadKeyName | undefined
    if (raw.key != null) {
      if (typeof raw.key !== 'string' || !isKeypadKeyName(raw.key)) return null
      key = raw.key
    }
    const modifiers: KeypadModifier[] = []
    // 媒体键（音量/亮度/播放）无组合语义，修饰键直接丢弃
    if (key == null || !isKeypadMediaKeyName(key)) {
      if (Array.isArray(raw.modifiers)) {
        for (const item of raw.modifiers) {
          if (typeof item === 'string' && isKeypadModifier(item) && !modifiers.includes(item)) {
            modifiers.push(item)
          }
        }
      }
    }
    // 主键与修饰键不能同时为空（空动作投递不出任何按键）
    if (key == null && !modifiers.length) return null
    return key == null ? { type: 'combo', modifiers } : { type: 'combo', modifiers, key }
  },
  createDefault() {
    // 默认不设主键：新增后由用户录制主键或勾选修饰键（Fn 只能勾选），
    // 两者皆空属未完成动作，归一化会拒绝、绑定面板禁用保存
    return { type: 'combo', modifiers: [] }
  }
}
