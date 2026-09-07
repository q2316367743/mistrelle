/**
 * ESP32-S3-LCD-1.28 服务（main 进程，模块级单例）：持有配置、编排串口连接、推送心跳。
 * 事件消费走 buddyEventBus 订阅（init 内注册，server 只发布，本模块与协议层解耦）；
 * 额度快照走 quotaBus 订阅（额度是独立公共域，本域是其消费设备之一）。
 * 下行协议 = LCD 心跳行协议 v2（见 lcdProtocol.ts）：事件映射 status 行（携带最近屏显额度），
 * 额度快照到达追加同状态额度行，空闲期每 5s 发 beat 保活（协议建议节奏）。
 * 连接编排/lastPort 记忆/意外断开处理都在本服务（渲染层只发指令与展示运行态）。
 */
import { BrowserWindow } from 'electron'
import { Esp32LcdChannels } from '@common/buddy/esp32-lcd/esp32LcdChannels'
import { isBuddyEvent } from '@common/types/buddyEvent'
import type {
  BuddyEventState,
  Esp32LcdConfig,
  Esp32LcdSaveResult,
  LcdConnectedState
} from '@common/types/esp32Lcd'
import type { QuotaSnapshot } from '@common/types/quota'
import { subscribeBuddyEvent } from '$/buddy/events/buddyEventBus'
import { createBuddyEventLatch } from '$/buddy/events/buddyEventLatch'
import { subscribeQuotaSnapshot } from '$/buddy/quota/quotaBus'
import { isSoftwareName, type SoftwareName } from '@common/types/trafficLight'
import {
  closePort,
  getState as getSerialState,
  listPorts,
  onPortClosed,
  openPort,
  writePort
} from '$/modules/serial/SerialService'
import {
  buildHeartbeatLine,
  LCD_STATUS_BY_EVENT,
  LCD_TEXT_BY_EVENT,
  pickScreenQuota,
  type LcdScreenQuota,
  type LcdStatus
} from './lcdProtocol'
import {
  defaultEsp32LcdConfig,
  loadEsp32LcdConfig,
  normalizeEsp32LcdConfig,
  saveEsp32LcdConfigFile
} from './esp32LcdConfig'

// 声明即给默认值：onBuddyEvent 经事件总线在任何时序下都可能被调用
let config: Esp32LcdConfig = defaultEsp32LcdConfig()
/** 最近一次事件（伙伴窗口 getState 首拉 + event 推送） */
let lastEvent: BuddyEventState | null = null
/** 最近一次事件来源软件（心跳行 platform 列；非事件心跳沿用，默认 opencode） */
let lastPlatform: SoftwareName = 'opencode'
/** 心跳状态机：当前屏幕状态（beat 沿用前一状态；由事件映射驱动） */
let lastStatus: LcdStatus = 'idle'
/** 事件锁存判定器：permission/done/ask 落屏后抑制思考类噪音事件，防状态被流式收尾覆盖 */
let shouldSuppressEvent = createBuddyEventLatch()
/** 心跳序号（协议 seq 列，单调递增供板端判新消息） */
let seq = 0
/** 最近屏显额度（心跳行 type/pct/value/unit 来源；额度快照到达/屏显配置变更时更新） */
let screenQuota: LcdScreenQuota | null = null
/** 最近一次额度快照（屏显额度选择变更时重挑，无需等下次刷新） */
let lastQuotaSnapshot: QuotaSnapshot | null = null

/** 广播给所有窗口（伙伴窗口订阅消费，主窗口无订阅无影响） */
export function broadcastEsp32Lcd(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

/** 连接运行态（配置 lastPort 已开视为已连接） */
export function getConnectedState(): LcdConnectedState {
  const connected = getSerialState().ports.some((item) => item.path === config.lastPort)
  return { connectedPath: connected ? config.lastPort : null }
}

/** 广播连接运行态给渲染层 */
function broadcastState(): void {
  broadcastEsp32Lcd(Esp32LcdChannels.state, getConnectedState())
}

/** 下行一条心跳行（未连接/写失败静默——屏幕是旁路反馈） */
function sendLine(line: string): void {
  if (!config.lastPort) return
  void writePort(config.lastPort, line + '\n').catch(() => {})
}

/** 组装并下发一条心跳（自动递增 seq）；platform 缺省沿用最近事件来源 */
function sendHeartbeat(status: LcdStatus, text?: string, platform?: SoftwareName): void {
  sendLine(buildHeartbeatLine({ status, seq: seq++, quota: screenQuota, platform: platform ?? lastPlatform, text }))
}

/** 启动初始化（main 启动即执行，不依赖渲染层）：订阅总线，加载配置并自动重连 */
export async function initEsp32Lcd(): Promise<void> {
  config = loadEsp32LcdConfig()
  // 订阅 buddy 事件总线（协议层发布 → 本域消费映射屏幕状态）
  subscribeBuddyEvent((platform, event) => onBuddyEvent(platform, event))
  // 订阅额度快照总线：更新屏显额度并追加一条同状态额度行（协议：额度变化 → 追加发送）
  subscribeQuotaSnapshot((snapshot: QuotaSnapshot) => {
    lastQuotaSnapshot = snapshot
    screenQuota = pickScreenQuota(snapshot, config.screenQuota)
    if (!screenQuota || !config.eventForward) return
    sendHeartbeat(lastStatus)
  })
  // 自己的端口意外断开（拔线）时：与主动断开一致清除记忆串口并广播运行态
  onPortClosed((path) => {
    if (path !== config.lastPort) return
    config.lastPort = ''
    saveEsp32LcdConfigFile(config)
    broadcastState()
  })
  // 空闲期 beat 保活（协议建议约 5s；状态计时只被非 beat 消息刷新；进程退出随系统清理）
  setInterval(() => {
    if (!config.lastPort || !config.eventForward) return
    sendHeartbeat('beat')
  }, 5_000)

  const port = config.lastPort
  if (!port || getSerialState().ports.some((item) => item.path === port)) return
  try {
    const paths = (await listPorts()).map((item) => item.path)
    if (!paths.includes(port)) return
    await openPort(port, config.baudRate)
    console.info('[esp32-lcd] 已自动连接串口', port)
    sendHeartbeat('idle')
  } catch (error) {
    console.info('[esp32-lcd] 自动连接串口失败，可在伙伴窗口手动重连', (error as Error).message)
  }
}

/**
 * 事件消费（事件总线订阅入口）：缓存最近事件并推送渲染层；
 * 命中状态映射时下发 status 心跳行（携带最近屏显额度，文案可覆写）。
 */
async function onBuddyEvent(platform: string, event: string): Promise<void> {
  if (!isSoftwareName(platform) || !isBuddyEvent(event)) return
  lastEvent = { platform, event, at: Date.now() }
  broadcastEsp32Lcd(Esp32LcdChannels.event, lastEvent)
  lastPlatform = platform
  if (!config.eventForward) return
  const status = LCD_STATUS_BY_EVENT[event]
  if (!status) return
  // 锁存期噪音（如 permission.asked 后紧随的流式收尾）不改状态、不下发心跳
  if (shouldSuppressEvent(event)) return
  lastStatus = status
  sendHeartbeat(status, LCD_TEXT_BY_EVENT[event], platform)
}

/**
 * 连接串口：成功即记忆 lastPort/baudRate 并广播运行态。
 * 连接编排与记忆收口在本服务，渲染层只发指令。
 */
export async function connect(path: string, baudRate?: number): Promise<Esp32LcdSaveResult> {
  const rate = baudRate ?? config.baudRate
  try {
    await openPort(path, rate)
  } catch (e) {
    return { ok: false, msg: '串口连接失败：' + (e as Error).message }
  }
  config.lastPort = path
  config.baudRate = rate
  saveEsp32LcdConfigFile(config)
  broadcastState()
  // 连接后推送初始待机心跳（Arduino/ESP32 open 复位后屏幕从已知状态开始）
  sendHeartbeat('idle')
  // 锁存重建、lastStatus 对齐：防跨连接的旧锁抑制后续事件
  shouldSuppressEvent = createBuddyEventLatch()
  lastStatus = 'idle'
  return { ok: true }
}

/** 断开当前连接：清除记忆串口并落盘（下次启动不再自动连接）后广播运行态 */
export async function disconnect(): Promise<void> {
  const path = config.lastPort
  if (!path) return
  await closePort(path)
  config.lastPort = ''
  saveEsp32LcdConfigFile(config)
  broadcastState()
}

/** 读取整份配置 */
export function getEsp32LcdConfig(): Esp32LcdConfig {
  return config
}

/** 读取最近一次事件 */
export function getLastEvent(): BuddyEventState | null {
  return lastEvent
}

/** 保存整份配置：归一化后落盘；屏显额度选择变更时按最近快照重挑并补发一条心跳（即时生效） */
export function saveEsp32LcdConfig(raw: unknown): Esp32LcdSaveResult {
  config = normalizeEsp32LcdConfig(raw)
  saveEsp32LcdConfigFile(config)
  screenQuota = pickScreenQuota(lastQuotaSnapshot, config.screenQuota)
  if (screenQuota && config.eventForward) sendHeartbeat(lastStatus)
  return { ok: true }
}
