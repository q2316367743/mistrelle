/**
 * 小键盘动作执行器注册表（main 进程）：动作序列顺序执行时逐条分发。
 * 新增动作：本目录加执行器文件并在 KEYPAD_ACTION_EXECUTORS 登记一行
 * （映射类型强制穷尽——漏注册或动作类型对不上直接 typecheck 报错）；
 * 对应的 @common 动作定义与渲染层编辑器同步登记，分发逻辑零改动。
 */
import type { KeypadAction, KeypadActionType } from '@common/types/keypad'
import { appExecutor } from './appExecutor'
import { comboExecutor } from './comboExecutor'
import { delayExecutor } from './delayExecutor'
import { scriptExecutor } from './scriptExecutor'
import { permissionExecutor } from './permissionExecutor'
import { urlExecutor } from './urlExecutor'

/** 单个动作类型的执行器：onPress 在序列执行到该动作时触发，可异步（如延时的 sleep Promise） */
export interface KeypadActionExecutor<T extends KeypadAction = KeypadAction> {
  onPress(action: T): void | Promise<void>
}

/**
 * 执行器注册表：键为动作类型联合（Record 键穷尽——新增动作漏登记 typecheck 报错）。
 * 值统一为 KeypadActionExecutor<KeypadAction>（方法双变，具体动作的执行器可直接登记）；
 * 各执行器实现时仍用自家动作类型约束参数（如 KeypadActionExecutor<KeypadComboAction>）。
 */
export const KEYPAD_ACTION_EXECUTORS: Record<KeypadActionType, KeypadActionExecutor<KeypadAction>> = {
  combo: comboExecutor,
  app: appExecutor,
  script: scriptExecutor,
  permission: permissionExecutor,
  delay: delayExecutor,
  url: urlExecutor
}
