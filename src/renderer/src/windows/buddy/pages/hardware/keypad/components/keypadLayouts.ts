/**
 * 键盘样式布局注册表（渲染层，纯展示）：config.layout 只存 id，行/跨格排布在此。
 * 新增样式 = @common 加 KeypadLayoutId 联合成员 + KEYPAD_LAYOUT_IDS 登记 + 此处加布局定义。
 * cells 按 DOM 顺序经 grid auto-placement 排布，cols/rows 为跨列/跨行数（大键位）。
 */
import type { KeypadLayoutId } from '@common/types/keypad'

export interface KeypadLayoutCell {
  /** 键位 id（设备行协议键位） */
  keyId: string
  /** 跨列数（默认 1），如键位 6 横跨 2 列 */
  cols?: number
  /** 跨行数（默认 1），如键位 1 竖跨 2 行 */
  rows?: number
}

export interface KeypadLayoutDefinition {
  id: KeypadLayoutId
  label: string
  /** grid 列数 */
  columns: number
  cells: KeypadLayoutCell[]
}

/** 样式一（4×2）：键位 1 左侧竖跨 2 行，键位 6 底部横跨 2 列 */
const GRID_4X2: KeypadLayoutDefinition = {
  id: 'grid4x2',
  label: '样式一（4×2）',
  columns: 4,
  cells: [
    { keyId: '1', rows: 2 },
    { keyId: '2' },
    { keyId: '3' },
    { keyId: '4' },
    { keyId: '5' },
    { keyId: '6', cols: 2 }
  ]
}

export const KEYPAD_LAYOUTS: readonly KeypadLayoutDefinition[] = [GRID_4X2]

/** 按 id 取布局定义（未注册/缺省回退首个） */
export function keypadLayoutOf(id: string | undefined): KeypadLayoutDefinition {
  return KEYPAD_LAYOUTS.find((layout) => layout.id === id) ?? KEYPAD_LAYOUTS[0]
}
