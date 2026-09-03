/**
 * 红绿灯服务（main 进程，模块级单例）：持有配置并执行「软件事件 → 灯态」映射，
 * 串口写入复用 serial 域 SerialService（serial 模块本身保持通用，不感知业务）。
 * 事件接入方（如 opencode 自定义协议插件的处理入口）只需调用 applyEvent(software, event)。
 */
import { getState, listPorts, openPort, writePort } from '$/modules/serial/SerialService'
import {
  OPENCODE_EVENT_NAMES,
  type OpencodeEventName,
  type SoftwareLightConfig,
  type SoftwareName,
  type TrafficLightConfig,
  type TrafficLightSaveResult
} from '~/modules/traffic-light/trafficLightChannels'
import {
  applySoftwareExclusion,
  defaultConfig,
  isSoftwareName,
  loadConfig,
  normalizeSoftware,
  saveConfigFile,
  validateBindingUniqueness
} from './trafficLightConfig'

// 声明即给默认值：applyEvent 是导出 API（协议层调用），任何调用时序下都安全
let config: TrafficLightConfig = defaultConfig()
/** 指令去重：事件流里同一灯态连续触发（如流式回复）不重复写串口 */
let lastCommand = ''

/** 启动初始化：加载配置；记住过端口且当前空闲则自动连接（失败静默，可在伙伴窗口重连） */
export async function initTrafficLight(): Promise<void> {
  config = loadConfig()
  const port = config.lastPort
  if (!port || getState().isOpen) return
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
 * 事件入口：软件启用且事件有绑定时，把灯态指令写入串口。
 * 未启用/未绑定/未连接一律忽略；连续同指令去重。
 */
export async function applyEvent(software: string, event: string): Promise<void> {
  if (!isSoftwareName(software)) return
  const item = config.config[software]
  if (!item || !item.enabled) return
  if (!(OPENCODE_EVENT_NAMES as readonly string[]).includes(event)) return
  const state = item.bindings[event as OpencodeEventName]
  if (!state || state === lastCommand) return
  try {
    await writePort(state + '\n')
    lastCommand = state
  } catch {
    // 串口未连接：灯效依赖连接，静默忽略，连接后由后续事件驱动
  }
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
  if (wasEnabled && !clean.enabled) void writePort('off\n').catch(() => {})
  return { ok: true }
}

/** 记住上次使用的串口（伙伴窗口连接成功后调用） */
export function setLastPort(path: string): void {
  config.lastPort = path
  saveConfigFile(config)
}
