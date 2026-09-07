/**
 * ESP32-S3-LCD-1.28 圆屏域类型契约：main / preload / renderer 跨端共享。
 * 约定：通道常量在 @common/buddy/esp32-lcd/esp32LcdChannels，
 * window 挂载由渲染层 vite-env.d.ts 声明（仅伙伴窗口独立 preload 注入）。
 * 配置由 main 持有，落盘 ~/.mistrelle/buddy/esp32-lcd.json（仅屏幕自身：串口/事件转发；
 * 额度插件是独立公共域，见 @common/types/quota，屏幕经 quotaBus 订阅快照下发）。
 */
import type { BuddyEventName } from './buddyEvent'
import type { SoftwareName } from './trafficLight'

/** 屏幕支持波特率（下拉选项与配置校验共用；ESP32-S3 常用 115200 起） */
export const LCD_BAUD_RATES: readonly number[] = [
  9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600
]

/** 默认波特率 */
export const LCD_DEFAULT_BAUD_RATE = 115200

/** ESP32 LCD 整份配置（落盘结构；额度插件配置在独立的 ~/.mistrelle/buddy/quota.json） */
export interface Esp32LcdConfig {
  /** 上次使用的串口路径；未记录为空串 */
  lastPort: string
  baudRate: number
  /** 是否把 buddy 事件经串口转发给屏幕 */
  eventForward: boolean
  /**
   * 屏显额度插件键（builtin id 或 external 文件名；空 = 默认）。
   * 额度快照聚合全部启用插件，屏上同时只显示一个额度：按键挑选对应插件的条目；
   * 缺省/选中键无效或该插件无带屏显字段的条目时，回落第一条带屏显字段的条目。
   */
  screenQuota?: string
}

/** 当前事件状态（渲染层展示用） */
export interface BuddyEventState {
  platform: SoftwareName
  event: BuddyEventName
  /** 事件时间（ms 时间戳） */
  at: number
}

/** 保存配置结果（失败时 msg 为中文原因，不抛错） */
export interface Esp32LcdSaveResult {
  ok: boolean
  msg?: string
}

/** 圆屏连接运行态（推送载荷：连接/断开/意外断开时广播） */
export interface LcdConnectedState {
  /** 当前已连接的串口路径（= 配置 lastPort 已开时）；未连接为 null */
  connectedPath: string | null
}

/** 圆屏完整运行态（getState 拉取：连接 + 最近事件；额度快照归 quota 域） */
export interface LcdRuntimeState extends LcdConnectedState {
  lastEvent: BuddyEventState | null
}

/** window.preload.esp32Lcd 契约：ESP32 LCD 域桥（仅伙伴窗口的独立 preload 注入，主窗口运行时不存在） */
export interface Esp32LcdApi {
  /** 读取整份配置 */
  getConfig(): Promise<Esp32LcdConfig>
  /** 保存整份配置（归一化后落盘） */
  saveConfig(config: Esp32LcdConfig): Promise<Esp32LcdSaveResult>
  /** 连接串口（成功即记忆 lastPort/baudRate 并广播运行态） */
  connect(path: string, baudRate?: number): Promise<Esp32LcdSaveResult>
  /** 断开当前连接 */
  disconnect(): Promise<void>
  /** 读取完整运行态（连接 + 最近事件） */
  getState(): Promise<LcdRuntimeState>
  /** 订阅当前事件变化推送；返回取消订阅函数 */
  onEvent(callback: (state: BuddyEventState) => void): () => void
  /** 订阅连接运行态变化推送；返回取消订阅函数 */
  onState(callback: (state: LcdConnectedState) => void): () => void
}
