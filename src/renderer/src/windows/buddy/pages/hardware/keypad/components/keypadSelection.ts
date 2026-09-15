/**
 * 键位选中态与路由派生（渲染层）：把「当前配置中的控件 + 信号路」的查找逻辑从页面组件抽出，
 * 避免 KeypadKeys 因选中/路由/绑定取值三件事叠加而越过 300 行红线。
 * 状态键是 `{ controlId, signal }`——一个控件占一个 cell，但它的每一路信号各自可配置。
 */
import type { KeypadBinding, KeypadBindingMap, KeypadBindSignal } from '@common/types/keypad'
import { controlRoutes, type KeypadBindRoute, type KeypadControlCell } from './keypadLayouts'

/** 当前配置中的目标（控件 + 其一路信号） */
export interface KeypadSelection {
  controlId: string
  signal: KeypadBindSignal
}

/** 拍平布局分组里的全部 cell，便于按 controlId 反查 */
export function flattenCells(groups: { cells: KeypadControlCell[] }[]): KeypadControlCell[] {
  return groups.flatMap((group) => group.cells)
}

/**
 * 由选中目标派生：所属 cell 与该 cell 的可绑定路。
 * 纯函数，供页面与面板共用，两者对「当前配置的是哪一路」保持同一口径。
 */
export interface SelectionContext {
  /** 选中目标所属的 cell（未选中/找不到为 null） */
  cell: KeypadControlCell | null
  /** 该 cell 的可绑定路（按键 1 路 / 旋钮 2–3 路） */
  routes: KeypadBindRoute[]
}

/** 计算选中目标所属 cell 与其可绑定路 */
export function selectionContext(
  cells: KeypadControlCell[],
  selection: KeypadSelection | null
): SelectionContext {
  if (!selection) return { cell: null, routes: [] }
  const cell = cells.find((item) => item.controlId === selection.controlId) ?? null
  return { cell, routes: cell ? controlRoutes(cell) : [] }
}

/** 取某控件某路绑定（未绑定为 null） */
export function bindingAt(
  bindings: Record<string, KeypadBindingMap> | undefined,
  selection: KeypadSelection | null
): KeypadBinding | null {
  if (!selection) return null
  return bindings?.[selection.controlId]?.[selection.signal] ?? null
}

/** 判断两个选中目标是否同一路 */
export function isSameSelection(a: KeypadSelection | null, b: KeypadSelection): boolean {
  return a != null && a.controlId === b.controlId && a.signal === b.signal
}

/** 该 cell 是否有任一路正处于配置中（用于控件选中态高亮） */
export function isCellSelected(selection: KeypadSelection | null, controlId: string): boolean {
  return selection != null && selection.controlId === controlId
}
