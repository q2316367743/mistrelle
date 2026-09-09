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
import type {
  KeypadAction,
  KeypadConfig,
  KeypadKeyAction,
  KeypadResult,
  KeypadState
} from '@common/types/keypad'
import { KEYPAD_ACTION_EXECUTORS } from './actions'
import { createKeypadParser, type KeypadKeyEvent } from './keypadProtocol'
import { defaultConfig, loadConfig, normalizeAction, saveConfigFile } from './keypadConfig'
import { isAccessibilityGranted, releaseAll } from './keySimulator'

// 声明即给默认值：数据回调在任何时序下都可能被触发
let config: KeypadConfig = defaultConfig()
/** 数据订阅退订函数（connect 时重挂；端口关闭由 SerialService 清理，此处仅防悬挂引用） */
let unsubscribeData: (() => void) | null = null
/** 当前按下的键位 id（含未绑定键位；设备 on/off 驱动） */
const pressed = new Set<string>()

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

/** 释放模拟侧残留并清空按下状态（断开/拔线/换连接共用） */
function resetPressed(): void {
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
 * 按下状态变化即广播；有绑定的键位查执行器注册表分发动作（无绑定仅状态点亮）。
 */
function handleEvent(event: KeypadKeyEvent): void {
  const { keyId, action } = event
  if (action === 'on') {
    if (pressed.has(keyId)) return
    pressed.add(keyId)
  } else {
    if (!pressed.has(keyId)) return
    pressed.delete(keyId)
  }
  const binding = config.bindings[keyId]
  if (binding) dispatchAction(binding, action)
  broadcastState()
}

/**
 * 查执行器注册表分发动作：on 走 onPress、off 走 onRelease（无 onRelease 的动作仅按下触发）。
 * fire-and-forget，同步异常吞掉只记日志（按键响应不阻塞、不抛出）；
 * 异步失败由各执行器自行记录（cliRun 永不 reject，shell.openPath 返回错误串）。
 */
function dispatchAction(binding: KeypadAction, action: KeypadKeyAction): void {
  try {
    const executor = KEYPAD_ACTION_EXECUTORS[binding.type]
    if (action === 'on') void executor.onPress(binding)
    else executor.onRelease?.(binding)
  } catch (error) {
    console.error('[keypad] 动作执行失败', error)
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
 * 全量保存键位绑定表：逐条归一化清洗后落盘。
 * 保存前释放按住中的组合（被移除/改绑的旧组合不残留）；不抛错，结果对象返回。
 */
export function saveBindings(input: Record<string, unknown>): KeypadResult {
  const bindings: Record<string, KeypadAction> = {}
  for (const [keyId, raw] of Object.entries(input)) {
    const action = normalizeAction(raw)
    if (action) bindings[keyId] = action
  }
  releaseAll()
  config.bindings = bindings
  saveConfigFile(config)
  return { ok: true }
}
