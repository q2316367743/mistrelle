/**
 * 小键盘服务（main 进程，模块级单例）：持有配置、编排串口连接、消费信号事件并驱动系统级模拟按键。
 * 设备上报 `<控件id>,<信号>[,<幅度两位>]` 且**不带任何行尾分隔符**，经 keypadProtocol 文法解析；
 * 串口原始数据读取复用 serial 域 SerialService（subscribePortData），模拟按键在 keySimulator（koffi）。
 * 序列执行与长按会话分别委托给 keypadSequence / keypadHold，本模块负责配置、连接与信号路由。
 *
 * **寻址统一为路由键 `controlId:signal`**（如 `1:on`、`10:left`）：控件的每一路信号各自独立
 * 持有一份计时器/重入守卫/长按会话，同一旋钮的左右转与按压互不干扰。绑定查找走
 * `config.bindings[controlId]?.[signal]`。**off 不可绑定**，只做释放语义（与 on 共用一个路由键）。
 *
 * 信号分两类处理：
 * - 按压类 on/off：on 去重后按长按判定分流（见下）；off 摘除 pressed、取消挂起计时
 *   （未达阈值 → 触发短按序列）并结束长按会话
 * - 转动类 left/right：瞬时事件，登记运行态 `rotation`（供界面高亮，超时自动过期）后**直接执行**
 *   该路动作序列，无去重、无长按（连续快转由设备重复上报信号表达）
 *
 * 主动断开、异常拔线、换连接、保存绑定一律 resetPressed：换代中止在途序列、清计时与长按会话、
 * 释放所有残留组合——保证断开瞬间所有按键事件立即停止。
 */
import { app, BrowserWindow } from 'electron'
import {
  closePort,
  getState as getSerialState,
  listPorts,
  onPortClosed,
  openPort,
  subscribePortData
} from '$/modules/serial/SerialService'
import { KeypadChannels } from '@common/buddy/keypad/keypadChannels'
import {
  isKeypadLayoutId,
  KEYPAD_HOLD_MS,
  type KeypadBindSignal,
  type KeypadConfig,
  type KeypadResult,
  type KeypadSignal,
  type KeypadSignalState,
  type KeypadState
} from '@common/types/keypad'
import { endAllHolds, endHold, startHold } from './keypadHold'
import { dispatchSequence, endSession, generation, resetSequences } from './keypadSequence'
import { createKeypadParser, type KeypadSignalEvent } from './keypadProtocol'
import { defaultConfig, loadConfig, normalizeBindings, saveConfigFile } from './keypadConfig'
import { isAccessibilityGranted, releaseAll } from './keySimulator'

/** 转动高亮的保留时长（ms）：转动是瞬时事件，main 登记后在此时长内保留供界面反馈 */
const ROTATION_HIGHLIGHT_MS = 180

// 声明即给默认值：数据回调在任何时序下都可能被触发
let config: KeypadConfig = defaultConfig()
/** 数据订阅退订函数（connect 时重挂；端口关闭由 SerialService 清理，此处仅防悬挂引用） */
let unsubscribeData: (() => void) | null = null
/** 当前按下的按压信号（含未绑定控件；设备 on/off 驱动），键 = 路由键 `controlId:on` */
const pressed = new Map<string, KeypadSignalState>()
/** 最近转动信号（键 = 路由键），到期自动移除；仅用于界面高亮 */
const rotation = new Map<string, KeypadSignalState>()
/** 转动高亮的过期计时器（键 = 路由键） */
const rotationTimers = new Map<string, ReturnType<typeof setTimeout>>()
/**
 * 挂起的长按判定计时器：路由键 → timer（仅配置了 holdActions 的按压路在 on 时启动）。
 * 到时仍按住 → 按长按序列形状推导的行为执行；阈值内 off → 取消计时并触发短按序列（互斥分流）。
 */
const holdTimers = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * 路由键：一个控件的每一路信号独立寻址。**按压路的 on/off 归一到同一路由**
 * （`1:on`——off 是 on 的释放语义，不是独立一路，否则 `pressed` 查询永远落空）；
 * 转动路各用自身信号（`10:left` / `10:right`）。
 */
function signalRoute(controlId: string, signal: KeypadSignal): string {
  return `${controlId}:${signal === 'off' ? 'on' : signal}`
}

/** 信号是否为按压类（on/off；转动类走另一条瞬时路径） */
function isPressSignal(signal: KeypadSignal): signal is 'on' | 'off' {
  return signal === 'on' || signal === 'off'
}

/** 取某控件某路的绑定（未绑定为 undefined） */
function bindingOf(controlId: string, signal: KeypadBindSignal) {
  return config.bindings[controlId]?.[signal]
}

/** 运行态（配置 lastPort 已开视为已连接；权限状态即查即返回） */
export function getState(): KeypadState {
  const connected = getSerialState().ports.some((item) => item.path === config.lastPort)
  return {
    connectedPath: connected ? config.lastPort : null,
    pressed: [...pressed.values()],
    rotation: [...rotation.values()],
    accessibilityGranted: isAccessibilityGranted()
  }
}

/** 广播运行态给渲染层（伙伴窗口订阅消费） */
function broadcastState(): void {
  const payload = getState()
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(KeypadChannels.state, payload)
  }
}

/** 清某路运行态：清转动高亮与过期计时、摘除按压态 */
function clearSignalState(key: string): void {
  const timer = rotationTimers.get(key)
  if (timer) {
    clearTimeout(timer)
    rotationTimers.delete(key)
  }
  rotation.delete(key)
  pressed.delete(key)
}

/** 清空全部信号运行态（断开/保存绑定共用；调用方负责随后广播） */
function clearSignalStates(): void {
  for (const timer of rotationTimers.values()) clearTimeout(timer)
  rotationTimers.clear()
  rotation.clear()
  pressed.clear()
}

/**
 * 登记转动高亮：写入 `rotation` 并重置过期计时（同路连转即续期，不会堆积多条）；
 * 到期移除并复播一次运行态。幅度（有极旋钮）一并带上供界面显示。
 */
function markRotation(controlId: string, signal: 'left' | 'right', value?: number): void {
  const state: KeypadSignalState = { controlId, signal }
  if (value != null) state.value = value
  const key = signalRoute(controlId, signal)
  rotation.set(key, state)
  const existing = rotationTimers.get(key)
  if (existing) clearTimeout(existing)
  rotationTimers.set(
    key,
    setTimeout(() => {
      rotationTimers.delete(key)
      rotation.delete(key)
      broadcastState()
    }, ROTATION_HIGHLIGHT_MS)
  )
}

/**
 * 立即停止并释放一切按键相关状态：清挂起的长按计时、终止在途序列与长按会话、清信号运行态并抬起残留组合。
 * 主动断开、异常拔线、换连接、保存绑定一律调用；顺序为**先换代中止在途序列**（防复位后又被写状态）再清理。
 */
function resetPressed(): void {
  resetSequences()
  for (const timer of holdTimers.values()) clearTimeout(timer)
  holdTimers.clear()
  endAllHolds()
  clearSignalStates()
  releaseAll()
}

/** 重新订阅当前端口的原始数据并接协议解析器（connect 内部调用） */
function subscribeData(): void {
  unsubscribeData?.()
  unsubscribeData = subscribePortData(config.lastPort, createKeypadParser(handleEvent))
}

/** 处理按压类 on：去重后按长按判定分流（配置了长按则起计时，否则立即执行短按序列） */
function handlePress(controlId: string): void {
  const key = signalRoute(controlId, 'on')
  if (pressed.has(key)) return
  pressed.set(key, { controlId, signal: 'on' })
  const gen = generation()
  const binding = bindingOf(controlId, 'on')
  const holdActions = binding?.holdActions
  if (holdActions?.length) {
    holdTimers.set(
      key,
      setTimeout(() => {
        holdTimers.delete(key)
        // 计时期间已断开（换代）→ 丢弃该次长按，不再触发动作
        if (gen !== generation()) return
        startHold({
          key,
          actions: holdActions,
          repeatMs: binding?.holdRepeatMs,
          generation: gen,
          isHeld: () => pressed.has(key)
        })
      }, KEYPAD_HOLD_MS)
    )
  } else if (binding) {
    dispatchSequence(key, binding.actions, gen)
  }
}

/** 处理按压类 off：摘除按下态；未达阈值的挂起计时转为短按序列，已达阈值的长按会话就此结束 */
function handleRelease(controlId: string): void {
  const key = signalRoute(controlId, 'on')
  if (!pressed.has(key)) return
  clearSignalState(key)
  const timer = holdTimers.get(key)
  if (timer) {
    clearTimeout(timer)
    holdTimers.delete(key)
    const binding = bindingOf(controlId, 'on')
    if (binding?.actions.length) dispatchSequence(key, binding.actions, generation())
  }
  endHold(key)
}

/** 处理转动类信号：登记瞬时高亮后直接执行该路序列（连续快转 = 设备重复上报，逐次触发） */
function handleRotation(controlId: string, signal: 'left' | 'right', value?: number): void {
  markRotation(controlId, signal, value)
  const binding = bindingOf(controlId, signal)
  if (binding?.actions.length) {
    dispatchSequence(signalRoute(controlId, signal), binding.actions, generation())
  }
}

/** 信号事件消费：按压类分短按/长按互斥判定，转动类直接执行（瞬时事件，无去重无长按） */
function handleEvent(event: KeypadSignalEvent): void {
  if (event.signal === 'off') {
    handleRelease(event.controlId)
  } else if (isPressSignal(event.signal)) {
    handlePress(event.controlId)
  } else {
    handleRotation(event.controlId, event.signal, event.value)
  }
  broadcastState()
}

/** 启动初始化（main 启动即执行，不依赖渲染层）：加载配置、订阅意外断开、按 lastPort 自动连接 */
export async function initKeypad(): Promise<void> {
  config = loadConfig()
  // 自己的端口意外断开（拔线）时：与主动断开一致立即停止所有按键动作、清除记忆串口并广播
  onPortClosed((path) => {
    if (path !== config.lastPort) return
    config.lastPort = ''
    saveConfigFile(config)
    resetPressed()
    broadcastState()
  })
  // 应用退出兜底：中止在途执行并释放按住中的组合，防修饰键卡死到系统
  app.once('will-quit', () => {
    endSession()
    releaseAll()
  })

  const port = config.lastPort
  if (!port) return
  try {
    const paths = (await listPorts()).map((item) => item.path)
    if (!paths.includes(port)) return
    await openPort(port)
    subscribeData()
    console.info('[keypad] 已自动连接串口', port)
  } catch (error) {
    console.info('[keypad] 自动连接串口失败，可在伙伴窗口手动重连', (error as Error).message)
  }
}

/** 读取整份配置 */
export function getConfig(): KeypadConfig {
  return config
}

/**
 * 连接串口（9600 默认波特率）：成功即记忆 lastPort、重挂行订阅并广播运行态。
 * openPort 内部会先关闭同 path 的旧端口（同步摘除数据监听），成功后再 resetPressed，
 * 避免连接失败时误清一个仍在工作的旧连接的按键状态。
 * 连接编排与记忆收口在本服务，渲染层只发指令。
 */
export async function connect(path: string): Promise<KeypadResult> {
  try {
    await openPort(path)
  } catch (e) {
    return { ok: false, msg: '串口连接失败：' + (e as Error).message }
  }
  config.lastPort = path
  saveConfigFile(config)
  resetPressed()
  subscribeData()
  broadcastState()
  return { ok: true }
}

/**
 * 断开当前连接：清除记忆串口并落盘、停止所有按键动作后广播运行态。
 * 先发起 closePort（其内部同步摘除数据监听，之后不会再有新按键进来）再 resetPressed，
 * 使循环/保持/挂起计时在端口关闭的等待期间就已停止，而不是等关闭完成才停。
 */
export async function disconnect(): Promise<void> {
  const path = config.lastPort
  const closing = path ? closePort(path) : Promise.resolve()
  config.lastPort = ''
  saveConfigFile(config)
  resetPressed()
  broadcastState()
  await closing
}

/**
 * 全量保存控件绑定表：逐控件逐信号归一化清洗后落盘（旧扁平格式自动迁移为 `{ on: 绑定 }`）。
 * 保存前中止一切在途按键执行并释放残留组合（被移除/改绑的旧动作不残留）；不抛错，结果对象返回。
 */
export function saveBindings(input: Record<string, unknown>): KeypadResult {
  resetPressed()
  config.bindings = normalizeBindings(input)
  saveConfigFile(config)
  return { ok: true }
}

/** 保存键盘样式布局：白名单校验后落盘（非法 id 拒绝，不抛错） */
export function saveLayout(layout: string): KeypadResult {
  if (!isKeypadLayoutId(layout)) return { ok: false, msg: '未知的键盘样式' }
  config.layout = layout
  saveConfigFile(config)
  return { ok: true }
}
