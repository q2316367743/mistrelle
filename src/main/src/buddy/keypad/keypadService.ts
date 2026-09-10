/**
 * 小键盘服务（main 进程，模块级单例）：持有配置、编排串口连接、解析按键流并驱动系统级模拟按键。
 * 设备上报 `<键位>,<on|off>` 且**不带任何行尾分隔符**，经 keypadProtocol 文法解析（非按行分帧）；
 * 串口原始数据读取复用 serial 域 SerialService（subscribePortData），模拟按键在 keySimulator（koffi）。
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
  type KeypadAction,
  type KeypadBinding,
  type KeypadConfig,
  type KeypadResult,
  type KeypadState
} from '@common/types/keypad'
import { KEYPAD_ACTION_EXECUTORS } from './actions'
import { createKeypadParser, type KeypadKeyEvent } from './keypadProtocol'
import { defaultConfig, loadConfig, normalizeBinding, saveConfigFile } from './keypadConfig'
import { isAccessibilityGranted, releaseAll } from './keySimulator'

// 声明即给默认值：数据回调在任何时序下都可能被触发
let config: KeypadConfig = defaultConfig()
/** 数据订阅退订函数（connect 时重挂；端口关闭由 SerialService 清理，此处仅防悬挂引用） */
let unsubscribeData: (() => void) | null = null
/** 当前按下的键位 id（含未绑定键位；设备 on/off 驱动） */
const pressed = new Set<string>()
/** 序列执行中的键位（防重入：序列含延时时长于物理按压，执行中忽略该键位的再次触发） */
const running = new Set<string>()
/**
 * 挂起的长按判定计时器：keyId → timer（仅配置了 holdActions 的键位在 on 时启动）。
 * 到时仍按住 → 长按序列；阈值内 off → 取消计时并触发短按序列（互斥分流）。
 */
const holdTimers = new Map<string, ReturnType<typeof setTimeout>>()

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

/** 释放模拟侧残留并清空按下状态与挂起的长按计时（断开/拔线/换连接共用） */
function resetPressed(): void {
  for (const timer of holdTimers.values()) clearTimeout(timer)
  holdTimers.clear()
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
 * 按下启动 KEYPAD_HOLD_MS 计时，到时仍按住执行长按序列；阈值内松手（off）执行短按序列。
 */
function handleEvent(event: KeypadKeyEvent): void {
  const { keyId, action } = event
  if (action === 'on') {
    if (pressed.has(keyId)) return
    pressed.add(keyId)
    const binding = config.bindings[keyId]
    const holdActions = binding?.holdActions
    if (holdActions?.length) {
      holdTimers.set(
        keyId,
        setTimeout(() => {
          holdTimers.delete(keyId)
          dispatchSequence(keyId, holdActions)
        }, KEYPAD_HOLD_MS)
      )
    } else if (binding) {
      dispatchSequence(keyId, binding.actions)
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
      if (binding?.actions.length) dispatchSequence(keyId, binding.actions)
    }
  }
  broadcastState()
}

/** 启动键位的动作序列：执行中再次触发直接忽略（防连按并发重入）；fire-and-forget 不抛出 */
function dispatchSequence(keyId: string, actions: KeypadAction[]): void {
  if (running.has(keyId)) return
  running.add(keyId)
  void runSequence(actions).finally(() => running.delete(keyId))
}

/**
 * 顺序执行动作序列：逐条查执行器注册表 await onPress（delay 执行器以 sleep Promise 形成间隔）。
 * 单条失败记日志继续下一条（按键响应不阻塞、不抛出；
 * 异步失败由各执行器自行记录，cliRun 永不 reject，shell.openPath 返回错误串）。
 */
async function runSequence(actions: KeypadAction[]): Promise<void> {
  for (const action of actions) {
    try {
      await KEYPAD_ACTION_EXECUTORS[action.type].onPress(action)
    } catch (error) {
      console.error('[keypad] 动作执行失败', error)
    }
  }
}

/** 启动初始化（main 启动即执行，不依赖渲染层）：加载配置、订阅意外断开、按 lastPort 自动连接 */
export async function initKeypad(): Promise<void> {
  config = loadConfig()
  // 自己的端口意外断开（拔线）时：与主动断开一致清除记忆串口、释放按住中的组合并广播
  onPortClosed((path) => {
    if (path !== config.lastPort) return
    config.lastPort = ''
    saveConfigFile(config)
    resetPressed()
    broadcastState()
  })
  // 应用退出兜底：释放按住中的组合，防修饰键卡死到系统
  app.once('will-quit', () => releaseAll())

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

/** 断开当前连接：清除记忆串口并落盘、释放按住中的组合后广播运行态 */
export async function disconnect(): Promise<void> {
  const path = config.lastPort
  if (!path) return
  await closePort(path)
  config.lastPort = ''
  saveConfigFile(config)
  resetPressed()
  broadcastState()
}

/**
 * 全量保存键位绑定表：逐个键位归一化清洗后落盘。
 * 保存前释放按住中的组合（被移除/改绑的旧组合不残留）；不抛错，结果对象返回。
 */
export function saveBindings(input: Record<string, unknown>): KeypadResult {
  const bindings: Record<string, KeypadBinding> = {}
  for (const [keyId, raw] of Object.entries(input)) {
    const binding = normalizeBinding(raw)
    if (binding) bindings[keyId] = binding
  }
  releaseAll()
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
