/**
 * 小键盘服务（main 进程，模块级单例）：持有配置、编排串口连接、解析按键流并驱动系统级模拟按键。
 * 设备上报 `<键位>,<on|off>` 且**不带任何行尾分隔符**，经 keypadProtocol 文法解析（非按行分帧）；
 * 串口原始数据读取复用 serial 域 SerialService（subscribePortData），模拟按键在 keySimulator（koffi）。
 * 长按行为由长按队列形状推导（见 resolveKeypadHoldBehavior / dispatchHold）：
 * 单条模拟按键=保持按住直到松手、多条=循环整个队列直到松手、单条其他类型=执行一次。
 * 主动断开、异常拔线、换连接、保存绑定一律 resetPressed：换代中止在途序列、清计时与循环保持会话、
 * 释放所有残留组合——保证断开瞬间所有按键事件立即停止。
 * 连接编排/lastPort 记忆/意外断开处理都在本服务（渲染层只发指令、编辑绑定与展示运行态）。
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
  KEYPAD_REPEAT_MAX_MS,
  KEYPAD_REPEAT_MS_DEFAULT,
  resolveKeypadHoldBehavior,
  type KeypadAction,
  type KeypadBinding,
  type KeypadComboAction,
  type KeypadConfig,
  type KeypadResult,
  type KeypadState
} from '@common/types/keypad'
import { KEYPAD_ACTION_EXECUTORS } from './actions'
import { createKeypadParser, type KeypadKeyEvent } from './keypadProtocol'
import { defaultConfig, loadConfig, normalizeBinding, saveConfigFile } from './keypadConfig'
import { isAccessibilityGranted, pressCombo, releaseAll, releaseCombo } from './keySimulator'

// 声明即给默认值：数据回调在任何时序下都可能被触发
let config: KeypadConfig = defaultConfig()
/** 数据订阅退订函数（connect 时重挂；端口关闭由 SerialService 清理，此处仅防悬挂引用） */
let unsubscribeData: (() => void) | null = null
/** 当前按下的键位 id（含未绑定键位；设备 on/off 驱动） */
const pressed = new Set<string>()
/**
 * 序列执行中的键位（防重入：序列含延时时长于物理按压，执行中忽略该键位的再次触发）。
 * 值为发起时的会话世代——断开后旧序列的收尾只清理自己的世代，不会误删重连后新序列的条目。
 */
const running = new Map<string, number>()
/**
 * 挂起的长按判定计时器：keyId → timer（仅配置了 holdActions 的键位在 on 时启动）。
 * 到时仍按住 → 循环执行长按序列；阈值内 off → 取消计时并触发短按序列（互斥分流）。
 */
const holdTimers = new Map<string, ReturnType<typeof setTimeout>>()

/** 运行中的长按循环会话（keyId → 循环；wake 用于抬手时中断当前间隔等待） */
interface HoldLoop {
  cancelled: boolean
  wake: (() => void) | null
}
const holdLoops = new Map<string, HoldLoop>()

/** 运行中的长按保持会话（keyId → 已按住的组合，抬手时倒序抬起） */
interface KeepSession {
  cancelled: boolean
  held: KeypadComboAction[]
}
const keepSessions = new Map<string, KeepSession>()

/**
 * 连接会话世代：断开（主动/拔线/换连接/保存绑定）即换代，让**在途序列、长按循环与挂起计时立即失效**。
 * 当前世代的 aborted 信号在换代时 resolve，使卡在延时/异步动作上的 await 立刻返回，
 * 不再向下执行后续按键动作（这是「断开后按键必须马上停」的关键一环）。
 * 注意：信号必须在下发时按世代捕获，不能读模块变量（换代后它已指向新世代的未决 promise）。
 */
let sessionGeneration = 0
let abortCurrentSession: () => void = () => {}
let sessionSignal: Promise<void> = new Promise((resolve) => {
  abortCurrentSession = resolve
})

/** 结束当前连接会话：中止在途执行（换代 + resolve 旧信号）并建档新会话供后续使用 */
function endSession(): void {
  abortCurrentSession()
  sessionGeneration += 1
  sessionSignal = new Promise((resolve) => {
    abortCurrentSession = resolve
  })
}

/** 运行态（配置 lastPort 已开视为已连接；权限状态即查即返回） */
export function getState(): KeypadState {
  const connected = getSerialState().ports.some((item) => item.path === config.lastPort)
  return {
    connectedPath: connected ? config.lastPort : null,
    pressed: [...pressed],
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

/** 结束键位的长按会话（幂等）：终止循环并唤醒间隔等待、倒序抬起保持中的组合 */
function endHoldSession(keyId: string): void {
  const loop = holdLoops.get(keyId)
  if (loop) {
    loop.cancelled = true
    holdLoops.delete(keyId)
    loop.wake?.()
  }
  const session = keepSessions.get(keyId)
  if (session) {
    keepSessions.delete(keyId)
    session.cancelled = true
    for (let i = session.held.length - 1; i >= 0; i -= 1) releaseCombo(session.held[i])
    session.held.length = 0
  }
}

/** 结束全部长按会话（断开/拔线/换连接/保存绑定共用） */
function cancelHoldSessions(): void {
  for (const keyId of [...new Set([...holdLoops.keys(), ...keepSessions.keys()])]) {
    endHoldSession(keyId)
  }
}

/**
 * 立即停止并释放一切按键相关状态：清挂起的长按计时、终止循环与保持会话、清按下集合并抬起残留组合。
 * 主动断开、异常拔线、换连接、保存绑定一律调用；顺序为先换代中止在途序列（防复位后又被写状态）再清理。
 */
function resetPressed(): void {
  endSession()
  running.clear()
  for (const timer of holdTimers.values()) clearTimeout(timer)
  holdTimers.clear()
  cancelHoldSessions()
  pressed.clear()
  releaseAll()
}
/** 重新订阅当前端口的原始数据并接协议解析器（connect 内部调用） */
function subscribeData(): void {
  unsubscribeData?.()
  unsubscribeData = subscribePortData(config.lastPort, createKeypadParser(handleEvent))
}

/**
 * 按键事件消费：on=按下、off=释放。
 * 按下状态变化即广播；未配置长按的键位在按下时顺序执行动作序列（现状行为）。
 * 配置了 holdActions 的键位启用短按/长按互斥判定：
 * 按下启动 KEYPAD_HOLD_MS 计时，到时仍按住按长按序列形状推导的行为执行（见 dispatchHold）。
 */
function handleEvent(event: KeypadKeyEvent): void {
  const { keyId, action } = event
  if (action === 'on') {
    if (pressed.has(keyId)) return
    pressed.add(keyId)
    const generation = sessionGeneration
    const binding = config.bindings[keyId]
    const holdActions = binding?.holdActions
    if (holdActions?.length) {
      holdTimers.set(
        keyId,
        setTimeout(() => {
          holdTimers.delete(keyId)
          // 计时期间已断开（换代）→ 丢弃该次长按，不再触发动作
          if (generation !== sessionGeneration) return
          dispatchHold(keyId, holdActions, generation)
        }, KEYPAD_HOLD_MS)
      )
    } else if (binding) {
      dispatchSequence(keyId, binding.actions, generation)
    }
  } else {
    if (!pressed.has(keyId)) return
    pressed.delete(keyId)
    const timer = holdTimers.get(keyId)
    if (timer) {
      // 未达长按阈值的释放 → 取消计时并触发短按（已达阈值时计时器已被回调移除，此处不触发）
      clearTimeout(timer)
      holdTimers.delete(keyId)
      const binding = config.bindings[keyId]
      if (binding?.actions.length) dispatchSequence(keyId, binding.actions, sessionGeneration)
    }
    // 已达阈值的长按会话（keep 保持 / repeat 循环）在抬手时结束
    endHoldSession(keyId)
  }
  broadcastState()
}

/**
 * 长按分发（按住达到 KEYPAD_HOLD_MS 后调用）：行为由长按队列形状推导，不做配置。
 * keep=单条模拟按键保持按住直到抬手（真正的长按该键）；
 * repeat=多条循环整个队列直到抬手（单条媒体键同样走循环）；
 * once=单条非模拟按键只执行一次。
 */
function dispatchHold(keyId: string, actions: KeypadAction[], generation: number): void {
  const behavior = resolveKeypadHoldBehavior(actions)
  if (behavior === 'keep') {
    void runKeepSession(keyId, actions, generation)
    return
  }
  if (behavior === 'repeat') {
    const interval = config.bindings[keyId]?.holdRepeatMs ?? KEYPAD_REPEAT_MS_DEFAULT
    void runRepeatLoop(keyId, actions, interval, generation)
    return
  }
  dispatchSequence(keyId, actions, generation)
}

/** 会话是否仍有效（断开换代后所有在途执行立即失效） */
function isSessionLive(generation: number): boolean {
  return generation === sessionGeneration
}

/**
 * 可中断等待：抬手（endHoldSession 调 wake）或断开（resetPressed 经 endSession 换代）立即 resolve。
 * 断开时无须额外唤醒——endHoldSession 会 wake，且调用方在 await 后还会复核 isSessionLive。
 */
function interruptibleSleep(loop: HoldLoop, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      loop.wake = null
      resolve()
    }, ms)
    loop.wake = () => {
      clearTimeout(timer)
      loop.wake = null
      resolve()
    }
  })
}

/**
 * 长按循环：立即执行第一轮，随后每 interval 执行一轮（一轮跑完再等间隔，串行不重叠），
 * 抬手/断开即停。每轮前复核会话有效、按键仍按住与总时长上限（防 off 丢失导致无限连发）。
 */
async function runRepeatLoop(
  keyId: string,
  actions: KeypadAction[],
  interval: number,
  generation: number
): Promise<void> {
  const loop: HoldLoop = { cancelled: false, wake: null }
  holdLoops.set(keyId, loop)
  const deadline = Date.now() + KEYPAD_REPEAT_MAX_MS
  try {
    while (
      isSessionLive(generation) &&
      !loop.cancelled &&
      pressed.has(keyId) &&
      Date.now() < deadline
    ) {
      await runSequence(actions, generation)
      if (!isSessionLive(generation) || loop.cancelled || !pressed.has(keyId) || Date.now() >= deadline) {
        break
      }
      await interruptibleSleep(loop, interval)
    }
  } finally {
    if (holdLoops.get(keyId) === loop) holdLoops.delete(keyId)
  }
}

/**
 * 长按保持：顺序执行长按队列，「模拟按键」调 pressCombo 且不自动抬起（抬手时统一释放），
 * 其余动作照常执行一次。断开/抬手经 endHoldSession 立即释放并按倒序抬起。
 */
async function runKeepSession(
  keyId: string,
  actions: KeypadAction[],
  generation: number
): Promise<void> {
  const session: KeepSession = { cancelled: false, held: [] }
  keepSessions.set(keyId, session)
  for (const action of actions) {
    if (session.cancelled || !isSessionLive(generation)) return
    try {
      if (action.type === 'combo') {
        pressCombo(action)
        session.held.push(action)
      } else {
        await KEYPAD_ACTION_EXECUTORS[action.type].onPress(action)
      }
    } catch (error) {
      console.error('[keypad] 长按保持动作执行失败', error)
    }
  }
}

/**
 * 启动键位的动作序列：执行中再次触发直接忽略（防连按并发重入）；fire-and-forget 不抛出。
 * 记录发起时的会话世代，断开换代后逐条复核，不再向下执行。
 */
function dispatchSequence(keyId: string, actions: KeypadAction[], generation: number): void {
  if (running.get(keyId) === generation) return
  running.set(keyId, generation)
  void runSequence(actions, generation).finally(() => {
    // 仅当仍是自己这一代时才清理（断开换代后重连的同键位新序列不受影响）
    if (running.get(keyId) === generation) running.delete(keyId)
  })
}

/**
 * 顺序执行动作序列：逐条查执行器注册表 await onPress（delay 执行器以 sleep Promise 形成间隔）。
 * 单条失败记日志继续下一条（按键响应不阻塞、不抛出）；
 * **每条执行前复核会话有效**——断开（主动/拔线）换代后立刻停止，
 * 且卡在延时/异步动作上的 await 会被 sessionAborted 唤醒（与当前动作的 Promise 竞速）。
 */
async function runSequence(actions: KeypadAction[], generation: number): Promise<void> {
  // 按世代捕获中止信号：断开换代时它 resolve，当前动作不再等待
  const signal = sessionSignal
  for (const action of actions) {
    if (!isSessionLive(generation)) return
    try {
      const executing = Promise.resolve(KEYPAD_ACTION_EXECUTORS[action.type].onPress(action))
      await Promise.race([executing, signal])
    } catch (error) {
      console.error('[keypad] 动作执行失败', error)
    }
  }
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
 * 全量保存键位绑定表：逐个键位归一化清洗后落盘。
 * 保存前中止一切在途按键执行并释放残留组合（被移除/改绑的旧动作不残留）；不抛错，结果对象返回。
 */
export function saveBindings(input: Record<string, unknown>): KeypadResult {
  const bindings: Record<string, KeypadBinding> = {}
  for (const [keyId, raw] of Object.entries(input)) {
    const binding = normalizeBinding(raw)
    if (binding) bindings[keyId] = binding
  }
  resetPressed()
  config.bindings = bindings
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
