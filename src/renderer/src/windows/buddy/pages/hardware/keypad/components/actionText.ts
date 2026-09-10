/**
 * 动作摘要文本（渲染层共享）：序列编辑器行 / 键帽行 / 配置面板副标题等纯文本场景使用；
 * 键帽的富渲染（app 图标等）在 KeypadKeyCap 自行叠加。
 */
import type { KeypadAction } from '@common/types/keypad'
import { KeypadModifierOptions, type KeypadKeyName, type KeypadModifier } from '@common/types/keypad'
import { appDisplayName } from './iconHref'

/** 组合键展示文本：修饰键名称 + 大写主键，如 Ctrl + Shift + F13 */
export function comboSummaryText(modifiers: KeypadModifier[], key: KeypadKeyName): string {
  const labelOf = (mod: KeypadModifier): string =>
    KeypadModifierOptions.find((opt) => opt.value === mod)?.label ?? mod
  return [...modifiers.map(labelOf), key.toUpperCase()].join(' + ')
}

/** 单条动作摘要文本（按 type 分支；延时带前缀防裸数字歧义） */
export function keypadActionSummary(action: KeypadAction): string {
  if (action.type === 'combo') return comboSummaryText(action.modifiers, action.key)
  if (action.type === 'app') return appDisplayName(action.path) || '未选择应用'
  if (action.type === 'permission')
    return action.decision === 'allow' ? '允许最近待审请求' : '拒绝最近待审请求'
  if (action.type === 'delay') return `延时 ${action.ms}ms`
  if (action.type === 'url') return action.url.trim() || '未填写网址'
  return action.command.trim() || '未填写命令'
}
