/**
 * 红绿灯（信号灯）域通道常量与类型（preload 桥与 main handler 共用）。
 * 通道命名沿用 'domain:action' 约定；配置由 main 进程持有，落盘 ~/.mistrelle/buddy/traffic-light.json。
 */

/** 灯态指令（Arduino 行协议：灯 r/g/y × 模式 o=常亮 s=闪烁） */
export type LightState = 'ro' | 'rs' | 'go' | 'gs' | 'yo' | 'ys'

/** 灯态全集（运行时校验用，与 LightState 保持一致） */
export const LIGHT_STATE_CODES: readonly LightState[] = ['ro', 'rs', 'go', 'gs', 'yo', 'ys']

/** 已接入的软件（互斥启用：同一时间只允许一个软件 enabled） */
export type SoftwareName = 'opencode'

/** 软件全集（运行时校验用，与 SoftwareName 保持一致） */
export const SOFTWARE_NAMES: readonly SoftwareName[] = ['opencode']

/** Opencode 事件目录（只保留对信号灯有意义的 6 个，与官方事件名一致） */
export type OpencodeEventName =
  | 'message.part.updated'
  | 'session.idle'
  | 'permission.asked'
  | 'session.error'
  | 'tool.execute.before'
  | 'tool.execute.after'

/** Opencode 事件全集（运行时校验用，与 OpencodeEventName 保持一致） */
export const OPENCODE_EVENT_NAMES: readonly OpencodeEventName[] = [
  'message.part.updated',
  'session.idle',
  'permission.asked',
  'session.error',
  'tool.execute.before',
  'tool.execute.after'
]

/** 单个软件的接入配置：启用开关 + 事件→灯态绑定（缺失 = 不响应） */
export interface SoftwareLightConfig {
  enabled: boolean
  bindings: Partial<Record<OpencodeEventName, LightState>>
}

/** 红绿灯配置（落盘结构）：lastPort 记住上次串口 + 各软件配置 */
export interface TrafficLightConfig {
  /** 上次使用的串口路径；未记录为空串 */
  lastPort: string
  config: Partial<Record<SoftwareName, SoftwareLightConfig>>
}

/** 保存软件配置的结果（失败时 msg 为中文原因，不抛错） */
export interface TrafficLightSaveResult {
  ok: boolean
  msg?: string
}

export const TrafficLightChannels = {
  /** 读取整份配置（含 lastPort 与各软件绑定） */
  getConfig: 'trafficLight:getConfig',
  /** 保存单个软件配置（灯态唯一/软件互斥由 main 校验归一） */
  saveSoftwareConfig: 'trafficLight:saveSoftwareConfig',
  /** 记住上次使用的串口（伙伴窗口连接成功后调用） */
  setLastPort: 'trafficLight:setLastPort'
} as const
