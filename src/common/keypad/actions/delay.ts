/**
 * 「延时等待」动作定义：动作序列执行到该步时暂停指定毫秒再继续后续动作。
 * 时长限定 50–60000ms（低于 50ms 无意义，上限防误配置长时间卡住序列）。
 */
import type { KeypadDelayAction } from '../../types/keypad'
import type { KeypadActionDefinition } from './index'

/** 延时时长下限（ms） */
export const DELAY_MS_MIN = 50
/** 延时时长上限（ms） */
export const DELAY_MS_MAX = 60000

export const delayAction: KeypadActionDefinition<KeypadDelayAction> = {
  type: 'delay',
  label: '延时等待',
  normalize(raw) {
    if (typeof raw.ms !== 'number' || !Number.isFinite(raw.ms)) return null
    const ms = Math.round(raw.ms)
    if (ms < DELAY_MS_MIN || ms > DELAY_MS_MAX) return null
    return { type: 'delay', ms }
  },
  createDefault() {
    return { type: 'delay', ms: 500 }
  }
}
