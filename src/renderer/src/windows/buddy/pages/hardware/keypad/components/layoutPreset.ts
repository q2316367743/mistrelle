/**
 * 布局预置应用（渲染层）：切换到带 preset 的样式时，把开箱默认映射补进未绑定的键位。
 * 只补空缺、不覆盖用户已有绑定（用户配过的键位保持原样）。
 * 返回需要落盘的完整绑定表；无任何新增时返回 null（调用方跳过保存）。
 */
import type { KeypadBinding } from '@common/types/keypad'
import type { KeypadLayoutDefinition } from './keypadLayouts'

export function applyLayoutPreset(
  layout: KeypadLayoutDefinition,
  current: Record<string, KeypadBinding>
): Record<string, KeypadBinding> | null {
  const preset = layout.preset
  if (!preset) return null
  const missing = Object.entries(preset).filter(([keyId]) => current[keyId] == null)
  if (!missing.length) return null
  const next = { ...current }
  for (const [keyId, binding] of missing) next[keyId] = binding
  return next
}
