/**
 * 动作摘要文本（渲染层共享）：popup 面板副标题等纯文本场景使用；
 * 键帽的富渲染（app 图标等）在 KeypadKeyCap 自行分支。
 */
import { KeypadModifierOptions, type KeypadKeyName, type KeypadModifier } from '@common/types/keypad'

/** 组合键展示文本：修饰键名称 + 大写主键，如 Ctrl + Shift + F13 */
export function comboSummaryText(modifiers: KeypadModifier[], key: KeypadKeyName): string {
  const labelOf = (mod: KeypadModifier): string =>
    KeypadModifierOptions.find((opt) => opt.value === mod)?.label ?? mod
  return [...modifiers.map(labelOf), key.toUpperCase()].join(' + ')
}
