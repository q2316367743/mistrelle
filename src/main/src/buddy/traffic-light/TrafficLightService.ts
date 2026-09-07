/**
 * 红绿灯服务（main 进程，模块级单例）：持有配置、编排串口连接、执行「软件事件 → 灯态」映射。
 * 事件消费走 buddyEventBus 订阅（init 内注册，server 只发布，本模块与协议层解耦）；
 * 连接编排/lastPort 记忆/意外断开处理都在本服务（渲染层只发指令与展示运行态）。
 * 串口写入复用 serial 域 SerialService（多端口，模块本身保持通用不感知业务）。
 */
import { BrowserWindow } from 'electron'
import { subscribeBuddyEvent } from '$/buddy/events/buddyEventBus'
import {
  closePort,
  getState as getSerialState,
  listPorts,
  onPortClosed,
  openPort,
  writePort
} from '$/modules/serial/SerialService'
import { TrafficLightChannels } from '@common/buddy/traffic-light/trafficLightChannels'
import { isBuddyEvent } from '@common/types/buddyEvent'
import {
  type SoftwareLightConfig,
  type SoftwareName,
  type TrafficLightConfig,
  type TrafficLightSaveResult,
  type TrafficLightState
} from '@common/types/trafficLight'
import {
  applySoftwareExclusion,
  defaultConfig,
  isSoftwareName,
  loadConfig,
  normalizeSoftware,
  saveConfigFile,
  validateBindingUniqueness
} from './trafficLightConfig'

// 声明即给默认值：applyEvent 经事件总线在任何时序下都可能被调用
let config: TrafficLightConfig = defaultConfig()
/** 指令去重：事件流里同一灯态连续触发（如流式回复）不重复写串口 */
let lastCommand = ''

/** 连接运行态（配置 lastPort 已开视为已连接） */
export function getState(): TrafficLightState {
  const connected = getSerialState().ports.some((item) => item.path === config.lastPort)
  return { connectedPath: connected ? config.lastPort : null }
}

/** 广播连接运行态给渲染层（伙伴窗口订阅消费） */
function broadcastState(): void {
  const payload = getState()
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(TrafficLightChannels.state, payload)
  }
}

/** 启动初始化（main 启动即执行，不依赖渲染层）：订阅事件总线与意外断开，加载配置并自动重连 */
export async function initTrafficLight(): Promise<void> {
  config = loadConfig()
  // 订阅 buddy 事件总线（协议层发布 → 本域消费映射灯态）
  subscribeBuddyEvent((platform, event) => applyEvent(platform, event))
  // 自己的端口意外断开（拔线）时：与主动断开一致清除记忆串口并广播运行态
  onPortClosed((path) => {
    if (path !== config.lastPort) return
    config.lastPort = ''
    saveConfigFile(config)
    lastCommand = ''
    broadcastState()
  })

  const port = config.lastPort
  if (!port || getSerialState().ports.some((item) => item.path === port)) return
  try {
    const paths = (await listPorts()).map((item) => item.path)
    if (!paths.includes(port)) return
    await openPort(port)
    console.info('[traffic-light] 已自动连接串口', port)
  } catch (error) {
    console.info('[traffic-light] 自动连接串口失败，可在伙伴窗口手动重连', (error as Error).message)
  }
}

/** 读取整份配置 */
export function getConfig(): TrafficLightConfig {
  return config
}

/**
 * 事件消费（事件总线订阅入口）：软件启用且事件有绑定时，把灯态指令写入串口。
 * 未启用/未绑定/未连接一律忽略；连续同指令去重。
 */
async function applyEvent(software: string, event: string): Promise<void> {
  if (!isSoftwareName(software)) return
  const item = config.config[software]
  if (!item || !item.enabled) return
  if (!isBuddyEvent(event)) return
  const state = item.bindings[event]
  if (!state || state === lastCommand) return
  try {
    await writePort(config.lastPort, state + '\n')
    lastCommand = state
  } catch {
    // 串口未连接：灯效依赖连接，静默忽略，连接后由后续事件驱动
  }
}

/**
 * 连接串口（9600，与 Arduino 端一致）：成功即记忆 lastPort 并广播运行态。
 * 连接编排与记忆收口在本服务，渲染层只发指令。
 */
export async function connect(path: string): Promise<TrafficLightSaveResult> {
  try {
    await openPort(path)
  } catch (e) {
    return { ok: false, msg: '串口连接失败：' + (e as Error).message }
  }
  config.lastPort = path
  saveConfigFile(config)
  // 重连后 Arduino 已复位全灭，指令去重缓存重置让首个事件能写入
  lastCommand = ''
  broadcastState()
  return { ok: true }
}

/** 断开当前连接：清除记忆串口并落盘（下次启动不再自动连接）后广播运行态 */
export async function disconnect(): Promise<void> {
  const path = config.lastPort
  if (!path) return
  await closePort(path)
  config.lastPort = ''
  saveConfigFile(config)
  lastCommand = ''
  broadcastState()
}

/** 发送一条灯态指令（调试面板用；未连接抛错由渲染层提示） */
export function sendCommand(code: string): Promise<void> {
  return writePort(config.lastPort, code + '\n')
}

/**
 * 保存单个软件配置：归一化入参 → 校验灯态绑定唯一 → 软件互斥归一 → 落盘。
 * 不抛错，结果对象返回（ok:false 时 msg 为中文原因）。
 */
export function saveSoftwareConfig(
  software: SoftwareName,
  input: SoftwareLightConfig
): TrafficLightSaveResult {
  const clean = normalizeSoftware(input)
  const duplicated = validateBindingUniqueness(clean.bindings)
  if (duplicated) return { ok: false, msg: duplicated }

  const wasEnabled = config.config[software]?.enabled === true
  config.config[software] = clean
  // 软件互斥：启用任一软件时停用其余软件
  if (clean.enabled) config.config = applySoftwareExclusion(config.config, software)
  saveConfigFile(config)
  // 指令去重缓存随配置变化重置，避免新旧配置语义混淆
  lastCommand = ''
  // 禁用软件时清灯（此前可能亮着该软件触发的灯态）
  if (wasEnabled && !clean.enabled) void writePort(config.lastPort, 'off\n').catch(() => {})
  return { ok: true }
}

/** 记住上次使用的串口（connect 内部已自动记忆，保留供特殊场景显式调用） */
export function setLastPort(path: string): void {
  config.lastPort = path
  saveConfigFile(config)
}
