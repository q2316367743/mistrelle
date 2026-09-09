/**
 * 小键盘动作编辑器注册表（渲染层）：按动作类型分发编辑组件。
 * 编辑器统一契约：props.action 为当前草稿动作（只读），变更经 emit('change') 回传
 * （单向数据流，草稿由 KeypadKeyCard 持有）；内部按 action.type 收窄到自家动作形状。
 * 新增动作：本目录加编辑器组件并在 KEYPAD_ACTION_EDITORS 登记一行
 * （映射类型强制穷尽，漏注册 typecheck 报错）；
 * 对应 @common 动作定义与 main 执行器同步登记，卡片框架零改动。
 */
import type { Component } from 'vue'
import { ApplicationIcon, CodeIcon, KeyboardIcon } from 'tdesign-icons-vue-next'
import type { KeypadAction, KeypadActionType } from '@common/types/keypad'
import AppEditor from './AppEditor.vue'
import ComboEditor from './ComboEditor.vue'
import ScriptEditor from './ScriptEditor.vue'

/** 编辑器注册表：键 = 动作类型判别 */
export const KEYPAD_ACTION_EDITORS: { [D in KeypadAction as D['type']]: Component } = {
  combo: ComboEditor,
  app: AppEditor,
  script: ScriptEditor
}

/** 动作类型图标（类型选择卡片等 UI 用；新增动作类型漏配此处编译报错） */
export const KEYPAD_ACTION_ICONS: Record<KeypadActionType, Component> = {
  combo: KeyboardIcon,
  app: ApplicationIcon,
  script: CodeIcon
}
