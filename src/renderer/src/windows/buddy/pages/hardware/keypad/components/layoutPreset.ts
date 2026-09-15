/**
 * 布局预置应用（渲染层）：切换到带 preset 的样式时，把开箱默认映射补进**未绑定的信号路**。
 * 补空缺粒度是「控件 + 信号」（旋钮左转/右转/按下各自判断），只补空缺、不覆盖用户已有绑定。
 * 返回需要落盘的完整绑定表；无任何新增时返回 null（调用方跳过保存）。
 */
import type { KeypadBindingMap } from '@common/types/keypad'
import type { KeypadLayoutDefinition } from './keypadLayouts'

export function applyLayoutPreset(
  layout: KeypadLayoutDefinition,
  current: Record<string, KeypadBindingMap>
): Record<string, KeypadBindingMap> | null {
  const preset = layout.preset
  if (!preset) return null
  const next: Record<string, KeypadBindingMap> = { ...current }
  let added = false
  for (const [controlId, presetMap] of Object.entries(preset)) {
    const merged: KeypadBindingMap = { ...current[controlId] }
    let filled = false
    for (const [signal, binding] of Object.entries(presetMap)) {
      const key = signal as keyof KeypadBindingMap
      if (merged[key] != null) continue
      merged[key] = binding
      filled = true
    }
    if (filled) {
      next[controlId] = merged
      added = true
    }
  }
  return added ? next : null
}
