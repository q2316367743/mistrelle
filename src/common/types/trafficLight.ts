/**
 * 红绿灯（信号灯）域类型契约：main / preload / renderer 跨端共享。
 * 约定：每个 type 下方紧跟同名 Options（Array<CommonSelect<type>>）作名称映射，
 * 运行时全集（*_NAMES / *_CODES）一律从 Options 派生防失同步；
 * 通道常量在 @common/buddy/traffic-light/trafficLightChannels，
 * window 挂载由渲染层 vite-env.d.ts 声明（仅伙伴窗口独立 preload 注入）。
 */
import { CommonSelect } from './CommonSelect'
import type { BuddyEventName } from './buddyEvent'

/** 灯态指令（Arduino 行协议：灯 r/g/y × 模式 o=常亮 s=闪烁 h=呼吸；off=全灭） */
export type LightState = 'ro' | 'rs' | 'rh' | 'go' | 'gs' | 'gh' | 'yo' | 'ys' | 'yh' | 'off'

/** 灯态名称映射（软件事件绑定下拉的选项源） */
export const LightStateOptions: Array<CommonSelect<LightState>> = [
  { value: 'ro', label: '红灯常亮' },
  { value: 'rs', label: '红灯闪烁' },
  { value: 'rh', label: '红灯呼吸' },
  { value: 'go', label: '绿灯常亮' },
  { value: 'gs', label: '绿灯闪烁' },
  { value: 'gh', label: '绿灯呼吸' },
  { value: 'yo', label: '黄灯常亮' },
  { value: 'ys', label: '黄灯闪烁' },
  { value: 'yh', label: '黄灯呼吸' },
  { value: 'off', label: '全灭' }
]

/** 灯态全集（运行时校验用，派生自 LightStateOptions） */
export const LIGHT_STATE_CODES: readonly LightState[] = LightStateOptions.map((opt) => opt.value)

/** 已接入的软件（互斥启用：同一时间只允许一个软件 enabled） */
export type SoftwareName = 'opencode' | 'zcode'

/** 软件名称映射 */
export const SoftwareNameOptions: Array<CommonSelect<SoftwareName>> = [
  { value: 'opencode', label: 'Opencode' },
  { value: 'zcode', label: 'ZCode' }
]

/** 软件全集（运行时校验用，派生自 SoftwareNameOptions） */
export const SOFTWARE_NAMES: readonly SoftwareName[] = SoftwareNameOptions.map((opt) => opt.value)

/** 软件名白名单校验（事件投递接口与各域服务共用；纯类型侧函数，main 无业务依赖） */
export function isSoftwareName(value: string): value is SoftwareName {
  return (SOFTWARE_NAMES as readonly string[]).includes(value)
}

/** 单个软件的接入配置：启用开关 + 事件→灯态绑定（缺失 = 不响应；事件全集见 @common/types/buddyEvent） */
export interface SoftwareLightConfig {
  enabled: boolean
  bindings: Partial<Record<BuddyEventName, LightState>>
}

/** 红绿灯配置（落盘结构）：lastPort 记住上次串口 + 各软件配置 */
export interface TrafficLightConfig {
  /** 上次使用的串口路径；未记录为空串 */
  lastPort: string
  config: Partial<Record<SoftwareName, SoftwareLightConfig>>
}

/** 保存/连接操作结果（失败时 msg 为中文原因，不抛错） */
export interface TrafficLightSaveResult {
  ok: boolean
  msg?: string
}

/** 红绿灯连接运行态（渲染层纯展示用；连接编排与记忆都在 main） */
export interface TrafficLightState {
  /** 当前已连接的串口路径（= 配置 lastPort 已开时）；未连接为 null */
  connectedPath: string | null
}

/** window.preload.trafficLight 契约：红绿灯域桥（仅伙伴窗口的独立 preload 注入，主窗口运行时不存在） */
export interface TrafficLightApi {
  /** 读取整份配置（含 lastPort 与各软件绑定） */
  getConfig(): Promise<TrafficLightConfig>
  /** 保存单个软件配置；结果由 main 校验给出（灯态唯一/软件互斥） */
  saveSoftwareConfig(
    software: SoftwareName,
    config: SoftwareLightConfig
  ): Promise<TrafficLightSaveResult>
  /** 记住上次使用的串口（连接成功时 main 自动调用，渲染层一般无需直接使用） */
  setLastPort(path: string): Promise<void>
  /** 连接串口（9600 固定波特率；成功即记忆 lastPort 并广播运行态） */
  connect(path: string): Promise<TrafficLightSaveResult>
  /** 断开当前连接 */
  disconnect(): Promise<void>
  /** 发送一条灯态指令（调试面板用；未连接时 reject） */
  sendCommand(code: string): Promise<void>
  /** 读取连接运行态 */
  getState(): Promise<TrafficLightState>
  /** 订阅连接运行态变化推送（连接/断开/意外断开）；返回取消订阅函数 */
  onState(callback: (state: TrafficLightState) => void): () => void
}
