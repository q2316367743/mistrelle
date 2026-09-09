/**
 * 小键盘动作注册表（@common 事实源）：每种键位动作一条定义（类型标识 / 中文名 /
 * 配置归一化 / 空白草稿工厂）。main 落盘清洗（keypadConfig）与渲染层保存预校验共用
 * normalize；渲染层卡片切动作类型时用 createDefault 建空白草稿。
 * 新增动作三步：①本目录加定义文件并在 KEYPAD_ACTIONS 登记 ②main buddy/keypad/actions
 * 加执行器 ③渲染层 actionEditors 加编辑器组件——类型联合（types/keypad.ts
 * KeypadActionType）同步加成员后，编译期穷尽校验会强制三端注册表齐活，漏注册直接报错。
 */
import type { KeypadAction, KeypadActionType } from '../../types/keypad'
import { appAction } from './app'
import { comboAction } from './combo'
import { delayAction } from './delay'
import { scriptAction } from './script'
import { permissionAction } from './permission'

/** 单个动作类型的定义 */
export interface KeypadActionDefinition<T extends KeypadAction = KeypadAction> {
  type: T['type']
  /** 中文名称（类型下拉选项与展示） */
  label: string
  /** 配置归一化：白名单清洗，非法返回 null 丢弃（main 落盘与渲染层保存预校验共用） */
  normalize(raw: Record<string, unknown>): T | null
  /** 空白草稿（渲染层切到该动作类型时的初始编辑值；可含待填空值，保存由 normalize 预校验拦截） */
  createDefault(): T
}

/** 动作注册表（as const 保字面量，供类型派生与穷尽校验） */
export const KEYPAD_ACTIONS = [comboAction, appAction, scriptAction, permissionAction, delayAction] as const

/** 动作类型下拉选项源（从注册表派生防失同步） */
export const KeypadActionTypeOptions: Array<{ value: KeypadActionType; label: string }> =
  KEYPAD_ACTIONS.map((definition) => ({ value: definition.type, label: definition.label }))

/** 动作类型白名单校验（渲染层 UI 收窄用） */
export function isKeypadActionType(value: string): value is KeypadActionType {
  return KEYPAD_ACTIONS.some((definition) => definition.type === value)
}

/** 按类型标识取动作定义（配置清洗与保存预校验用；未注册类型返回 null） */
export function keypadActionDefinition(type: string): KeypadActionDefinition | null {
  return KEYPAD_ACTIONS.find((definition) => definition.type === type) ?? null
}

/**
 * 编译期穷尽校验：KeypadActionType 联合新增成员而注册表未登记时，
 * MissingActionType 非 never，true 不能赋给错误元组类型 → typecheck 报错。
 */
type MissingActionType = Exclude<KeypadActionType, (typeof KEYPAD_ACTIONS)[number]['type']>
const _registryExhaustive: MissingActionType extends never
  ? true
  : ['KeypadActionType 存在未在 KEYPAD_ACTIONS 注册的成员'] = true
void _registryExhaustive
