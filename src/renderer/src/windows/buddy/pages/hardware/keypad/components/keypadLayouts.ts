/**
 * 键盘样式布局注册表（渲染层，纯展示）：config.layout 只存 id，分组/跨格排布在此。
 * 新增样式 = @common 加 KeypadLayoutId 联合成员 + KEYPAD_LAYOUT_IDS 登记 + 此处加布局定义。
 * 布局由「分组」构成（可多组，组间渲染视觉分隔），每组内含若干 cell：
 * 普通键位（kind: 'key'）与旋钮（kind: 'knob'）；cells 按 DOM 顺序经 grid auto-placement
 * 排布，cols/rows 为跨列/跨行数（大键位）。
 * 旋钮三路（右转/左转/按下）各占一个普通键位号，走与按键相同的 `<键位>,on|off` 行协议；
 * **是否可按压是布局配置**——pressKey 缺省即该旋钮不可按压，UI 相应少一路（不写死三路）。
 */
import type { KeypadBinding, KeypadLayoutId } from '@common/types/keypad'

/** 普通键位 cell（cols/rows 为跨列/跨行数，默认 1） */
export interface KeypadKeyCell {
  kind: 'key'
  /** 键位 id（设备行协议键位） */
  keyId: string
  /** 跨列数（默认 1），如键位 6 横跨 2 列 */
  cols?: number
  /** 跨行数（默认 1），如键位 1 竖跨 2 行 */
  rows?: number
}

/**
 * 旋钮 cell（无极，可左右转）：左右转与按下各占一个键位号，由设备按普通按键上报。
 * pressKey 缺省 = 该旋钮不可按压（布局能力差异，不是缺失）。
 */
export interface KeypadKnobCell {
  kind: 'knob'
  /** 右转（顺时针）上报的键位号 */
  cwKey: string
  /** 左转（逆时针）上报的键位号 */
  ccwKey: string
  /** 按下上报的键位号；缺省 = 该旋钮不可按压 */
  pressKey?: string
}

export type KeypadLayoutCell = KeypadKeyCell | KeypadKnobCell

/** 布局分组：一组等宽列的按键/旋钮；组间渲染视觉分隔 */
export interface KeypadLayoutGroup {
  /** 本组 grid 列数 */
  columns: number
  cells: KeypadLayoutCell[]
}

export interface KeypadLayoutDefinition {
  id: KeypadLayoutId
  label: string
  groups: KeypadLayoutGroup[]
  /** 该样式开箱默认映射（切换到本样式时仅补未绑定键位，不覆盖已有绑定） */
  preset?: Record<string, KeypadBinding>
}

/** 旋钮的绑定路（供配置面板的路切换条渲染；由布局派生，可按压 3 路 / 不可按压 2 路） */
export interface KeypadKnobRoute {
  keyId: string
  label: string
}

/** 旋钮 cell 的绑定路列表（顺序：左转 → 右转 → 按下；按下仅在布局配置了 pressKey 时出现） */
export function knobRoutes(cell: KeypadKnobCell): KeypadKnobRoute[] {
  const routes: KeypadKnobRoute[] = [
    { keyId: cell.ccwKey, label: '左转' },
    { keyId: cell.cwKey, label: '右转' }
  ]
  if (cell.pressKey != null) routes.push({ keyId: cell.pressKey, label: '按下' })
  return routes
}

/** 样式一（4×2）：键位 1 左侧竖跨 2 行，键位 6 底部横跨 2 列 */
const GRID_4X2: KeypadLayoutDefinition = {
  id: 'grid4x2',
  label: '样式一（4×2）',
  groups: [
    {
      columns: 4,
      cells: [
        { kind: 'key', keyId: '1', rows: 2 },
        { kind: 'key', keyId: '2' },
        { kind: 'key', keyId: '3' },
        { kind: 'key', keyId: '4' },
        { kind: 'key', keyId: '5' },
        { kind: 'key', keyId: '6', cols: 2 }
      ]
    }
  ]
}

/**
 * 样式二（4×2 + 旋钮）：左组 4×2 八个按键（键位 1–8），
 * 右组 1×2（上=旋钮、下=按键 9），两组间为视觉分隔。
 * 旋钮：右转 10 / 左转 11 / 按下 12；预置音量映射（右转音量+、左转音量-、按下静音）。
 * 若设备旋钮不可按压，删掉 pressKey 与 '12' 预置即可——UI 自动收敛为两路。
 */
const GRID_4X2_KNOB: KeypadLayoutDefinition = {
  id: 'grid4x2Knob',
  label: '样式二（4×2 + 旋钮）',
  groups: [
    {
      columns: 4,
      cells: ['1', '2', '3', '4', '5', '6', '7', '8'].map((keyId) => ({
        kind: 'key' as const,
        keyId
      }))
    },
    {
      columns: 1,
      cells: [
        { kind: 'knob', cwKey: '10', ccwKey: '11', pressKey: '12' },
        { kind: 'key', keyId: '9' }
      ]
    }
  ],
  preset: {
    '10': { name: '音量 +', actions: [{ type: 'combo', modifiers: [], key: 'volume-up' }] },
    '11': { name: '音量 -', actions: [{ type: 'combo', modifiers: [], key: 'volume-down' }] },
    '12': { name: '静音', actions: [{ type: 'combo', modifiers: [], key: 'mute' }] }
  }
}

export const KEYPAD_LAYOUTS: readonly KeypadLayoutDefinition[] = [GRID_4X2, GRID_4X2_KNOB]

/** 按 id 取布局定义（未注册/缺省回退首个） */
export function keypadLayoutOf(id: string | undefined): KeypadLayoutDefinition {
  return KEYPAD_LAYOUTS.find((layout) => layout.id === id) ?? KEYPAD_LAYOUTS[0]
}
