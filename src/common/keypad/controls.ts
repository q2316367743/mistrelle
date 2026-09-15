/**
 * 控件信号派生（@common 事实源）：由「基础类型 + 拓展能力」算出控件的协议信号集与可绑定路。
 *
 * 这张表是控件模型的唯一拓展点——布局注册表只声明 `kind` 与 `capabilities`，
 * 具体信号一律由此派生，故新增一种控件/能力时渲染层与 main 都无需改判定分支：
 * - 基础类型 OWN_SIGNALS：button 自带 on/off、knob 自带 left/right
 * - 拓展能力 CAPABILITY_SIGNALS：press 叠加 on/off；detent **不叠加信号**（它给转动信号加幅度）
 *
 * 两张 `Record<联合, ...>` 表天然穷尽：联合新增成员而此处漏登记，typecheck 直接报错。
 */
import {
  type KeypadBindSignal,
  type KeypadControlCapability,
  type KeypadControlKind,
  type KeypadSignal
} from '../types/keypad'

/** 各基础类型自带的信号（物理形态决定） */
const CONTROL_SIGNALS: Record<KeypadControlKind, readonly KeypadSignal[]> = {
  button: ['on', 'off'],
  knob: ['left', 'right']
}

/** 各拓展能力叠加的信号（detent 为空——它改变的是转动信号的负载而非信号集） */
const CAPABILITY_SIGNALS: Record<KeypadControlCapability, readonly KeypadSignal[]> = {
  press: ['on', 'off'],
  detent: []
}

/** 信号全集顺序（派生结果按此排序，保证界面路序稳定：按下 → 抬起 → 左转 → 右转） */
const SIGNAL_ORDER: readonly KeypadSignal[] = ['on', 'off', 'left', 'right']

/**
 * 控件的协议信号集：基础类型自带信号 ∪ 各拓展能力叠加信号，按 SIGNAL_ORDER 排序。
 * 用于协议解析与能力展示（含 off 这类不可绑定信号）。
 */
export function keypadControlSignals(
  kind: KeypadControlKind,
  capabilities: readonly KeypadControlCapability[] = []
): KeypadSignal[] {
  const all = new Set<KeypadSignal>(CONTROL_SIGNALS[kind])
  for (const capability of capabilities) {
    for (const signal of CAPABILITY_SIGNALS[capability]) all.add(signal)
  }
  return SIGNAL_ORDER.filter((signal) => all.has(signal))
}

/**
 * 控件的可绑定路（排除 off——它只有释放语义，不可绑定）。
 * 顺序即配置面板路切换条顺序；长度 = 该控件的可绑定路数（旋钮可按压 3 路 / 不可按压 2 路）。
 */
export function keypadControlBindSignals(
  kind: KeypadControlKind,
  capabilities: readonly KeypadControlCapability[] = []
): KeypadBindSignal[] {
  return keypadControlSignals(kind, capabilities).filter(
    (signal): signal is KeypadBindSignal => signal !== 'off'
  )
}
