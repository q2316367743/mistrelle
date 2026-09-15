/**
 * 键盘样式布局注册表（渲染层，纯展示）：config.layout 只存 id，控件类型/能力/跨格排布在此。
 * 新增样式 = @common 加 KeypadLayoutId 联合成员 + KEYPAD_LAYOUT_IDS 登记 + 此处加布局定义。
 *
 * **布局只声明「控件 id + 基础类型 + 拓展能力」**，具体信号由 @common/keypad/controls 的
 * `keypadControlBindSignals(kind, capabilities)` 派生——升级实物（如旋钮加按压、改有极）只改
 * capabilities，路由/绑定路/高亮全部自动跟随，判定分支零改动：
 * - button：内置 on/off → 1 条可绑定路（按下）
 * - knob：内置 left/right → 2 条；叠加 press 能力 → 3 条（左转/右转/按下）
 *
 * cells 按 DOM 顺序经 grid auto-placement 排布，cols/rows 为跨列/跨行数（大键位）。
 */
import { keypadControlBindSignals } from '@common/keypad/controls'
import {
  keypadSignalLabel,
  type KeypadBindingMap,
  type KeypadBindSignal,
  type KeypadControlCapability,
  type KeypadControlKind,
  type KeypadLayoutId
} from '@common/types/keypad'

/**
 * 控件 cell（按键与旋钮同构，差别只在 kind 与 capabilities）：
 * 一个控件占一个 cell、一个 controlId；它的可绑定路由此派生。
 */
export interface KeypadControlCell {
  kind: KeypadControlKind
  /** 控件 id（设备行协议第一段） */
  controlId: string
  /** 拓展能力（可按压 / 有极带幅度）；缺省即基础形态 */
  capabilities?: KeypadControlCapability[]
  /** 跨列数（默认 1），如控件 6 横跨 2 列 */
  cols?: number
  /** 跨行数（默认 1），如控件 1 竖跨 2 行 */
  rows?: number
}

/** 布局分组：一组等宽列的控件；组间渲染视觉分隔 */
export interface KeypadLayoutGroup {
  /** 本组 grid 列数 */
  columns: number
  cells: KeypadControlCell[]
}

export interface KeypadLayoutDefinition {
  id: KeypadLayoutId
  label: string
  groups: KeypadLayoutGroup[]
  /** 该样式开箱默认映射（切换到本样式时仅补未绑定信号，不覆盖已有绑定） */
  preset?: Record<string, KeypadBindingMap>
}

/** 控件的绑定路（供配置面板的路切换条渲染；由 kind + capabilities 派生） */
export interface KeypadBindRoute {
  signal: KeypadBindSignal
  label: string
}

/** 控件的可绑定路列表（顺序：按下 → 左转 → 右转，由 controls 派生） */
export function controlRoutes(cell: KeypadControlCell): KeypadBindRoute[] {
  return keypadControlBindSignals(cell.kind, cell.capabilities).map((signal) => ({
    signal,
    label: keypadSignalLabel(signal)
  }))
}

/** 便捷构造普通按键 cell（无拓展能力） */
function button(controlId: string, extra?: Partial<KeypadControlCell>): KeypadControlCell {
  return { kind: 'button', controlId, ...extra }
}

/** 样式一（4×2）：控件 1 左侧竖跨 2 行，控件 6 底部横跨 2 列 */
const GRID_4X2: KeypadLayoutDefinition = {
  id: 'grid4x2',
  label: '样式一（4×2）',
  groups: [
    {
      columns: 4,
      cells: [
        button('1', { rows: 2 }),
        button('2'),
        button('3'),
        button('4'),
        button('5'),
        button('6', { cols: 2 })
      ]
    }
  ]
}

/**
 * 样式二（4×2 + 旋钮）：左组 4×2 八个按键（控件 1–8），
 * 右组 1×2（上=旋钮、下=按键 9），两组间为视觉分隔。
 * 旋钮：控件 10，可按压（左转/右转/按下三路），预置音量映射（右转音量+、左转音量-、按下静音）。
 * 若实物旋钮不可按压，去掉 capabilities 里的 'press' 即可——UI 自动收敛为两路；
 * 若为**有极旋钮**，再加 'detent'（转动信号将携带幅度百分比）。
 */
const GRID_4X2_KNOB: KeypadLayoutDefinition = {
  id: 'grid4x2Knob',
  label: '样式二（4×2 + 旋钮）',
  groups: [
    {
      columns: 4,
      cells: ['1', '2', '3', '4', '5', '6', '7', '8'].map((controlId) => button(controlId))
    },
    {
      columns: 1,
      cells: [{ kind: 'knob', controlId: '10', capabilities: ['press'] }, button('9')]
    }
  ],
  preset: {
    '10': {
      left: { name: '音量 -', actions: [{ type: 'combo', modifiers: [], key: 'volume-down' }] },
      right: { name: '音量 +', actions: [{ type: 'combo', modifiers: [], key: 'volume-up' }] },
      on: { name: '静音', actions: [{ type: 'combo', modifiers: [], key: 'mute' }] }
    }
  }
}

export const KEYPAD_LAYOUTS: readonly KeypadLayoutDefinition[] = [GRID_4X2, GRID_4X2_KNOB]

/** 按 id 取布局定义（未注册/缺省回退首个） */
export function keypadLayoutOf(id: string | undefined): KeypadLayoutDefinition {
  return KEYPAD_LAYOUTS.find((layout) => layout.id === id) ?? KEYPAD_LAYOUTS[0]
}
