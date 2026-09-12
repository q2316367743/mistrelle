/**
 * 动作摘要文本（渲染层共享）：序列编辑器行 / 键帽行 / 配置面板副标题等纯文本场景使用；
 * 键帽的富渲染（app 图标等）在 KeypadKeyCap 自行叠加。
 */
import type { KeypadAction, KeypadKeyName, KeypadModifier } from '@common/types/keypad'
import { isKeypadMediaKeyName, KeypadModifierOptions, keypadKeyLabel } from '@common/types/keypad'
import { appDisplayName } from './iconHref'

/**
 * 组合键的键帽 token 列表：媒体键是单个 token（中文名本身含空格与加号，不能再按 + 拆）、
 * 普通组合 = 各修饰键名 + 主键名。摘要文本与键帽展示共用，避免两处规则漂移。
 * 主键缺省（只按住修饰键，如 Fn）时只输出修饰键 token。
 */
export function comboKeyTokens(
  modifiers: KeypadModifier[],
  key: KeypadKeyName | undefined
): string[] {
  if (key != null && isKeypadMediaKeyName(key)) return [keypadKeyLabel(key)]
  const labelOf = (mod: KeypadModifier): string =>
    KeypadModifierOptions.find((opt) => opt.value === mod)?.label ?? mod
  return [...modifiers.map(labelOf), ...(key == null ? [] : [keypadKeyLabel(key)])]
}

/** 组合键展示文本：修饰键名称 + 主键，如 Ctrl + Shift + F13；无主键时只有修饰键 */
export function comboSummaryText(
  modifiers: KeypadModifier[],
  key: KeypadKeyName | undefined
): string {
  return comboKeyTokens(modifiers, key).join(' + ')
}

/** 单条动作摘要文本（按 type 分支；延时带前缀防裸数字歧义） */
export function keypadActionSummary(action: KeypadAction): string {
  // 主键与修饰键皆空 = 刚添加、尚未选键（归一化会拒绝保存，此处给占位文案）
  if (action.type === 'combo') {
    return comboSummaryText(action.modifiers, action.key) || '未选择按键'
  }
  if (action.type === 'app') return appDisplayName(action.path) || '未选择应用'
  if (action.type === 'permission')
    return action.decision === 'allow' ? '允许最近待审请求' : '拒绝最近待审请求'
  if (action.type === 'delay') return `延时 ${action.ms}ms`
  if (action.type === 'url') return action.url.trim() || '未填写网址'
  return action.command.trim() || '未填写命令'
}
