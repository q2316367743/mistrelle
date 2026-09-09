/** 「延时等待」动作执行器：暂停指定毫秒（序列顺序执行时 await 此 Promise 形成动作间隔） */
import type { KeypadDelayAction } from '@common/types/keypad'
import type { KeypadActionExecutor } from './index'

export const delayExecutor: KeypadActionExecutor<KeypadDelayAction> = {
  onPress: (action) => new Promise<void>((resolve) => setTimeout(resolve, action.ms))
}
