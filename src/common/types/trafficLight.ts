/**
 * 红绿灯（信号灯）域类型契约：main / preload / renderer 跨端共享。
 * 约定：每个 type 下方紧跟同名 Options（Array<CommonSelect<type>>）作名称映射，
 * 运行时全集（*_NAMES / *_CODES）一律从 Options 派生防失同步；
 * 通道常量在 @common/buddy/traffic-light/trafficLightChannels，
 * window 挂载由渲染层 vite-env.d.ts 声明（仅伙伴窗口独立 preload 注入）。
 */
import { CommonSelect } from './CommonSelect'

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
export type SoftwareName = 'opencode'

/** 软件名称映射 */
export const SoftwareNameOptions: Array<CommonSelect<SoftwareName>> = [
  { value: 'opencode', label: 'Opencode' }
]

/** 软件全集（运行时校验用，派生自 SoftwareNameOptions） */
export const SOFTWARE_NAMES: readonly SoftwareName[] = SoftwareNameOptions.map((opt) => opt.value)

/** Opencode 事件目录（只保留对信号灯有意义的 6 个，与官方事件名一致） */
export type OpencodeEventName =
  | 'message.part.updated'
  | 'session.idle'
  | 'permission.asked'
  | 'session.error'
  | 'tool.execute.before'
  | 'tool.execute.after'

/** Opencode 事件名称映射 */
export const OpencodeEventNameOptions: Array<CommonSelect<OpencodeEventName>> = [
  { value: 'message.part.updated', label: '正在回复' },
  { value: 'tool.execute.before', label: '开始执行工具' },
  { value: 'tool.execute.after', label: '工具执行结束' },
  { value: 'session.idle', label: '回复完成' },
  { value: 'permission.asked', label: '等待授权' },
  { value: 'session.error', label: '会话出错' }
]

/** Opencode 事件全集（运行时校验用，派生自 OpencodeEventNameOptions） */
export const OPENCODE_EVENT_NAMES: readonly OpencodeEventName[] = OpencodeEventNameOptions.map(
  (opt) => opt.value
)

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

/**
 * 软件事件接入配置状态（如 opencode 插件是否已装入其插件目录）：
 * missing=未安装；outdated=已安装但内容与内置模板不一致（可更新）；ready=已就绪。
 */
export type PlatformConfigStatus = 'missing' | 'outdated' | 'ready'

/** 接入配置状态名称映射 */
export const PlatformConfigStatusOptions: Array<CommonSelect<PlatformConfigStatus>> = [
  { value: 'missing', label: '未安装' },
  { value: 'outdated', label: '待更新' },
  { value: 'ready', label: '已就绪' }
]

/** 接入配置检查结果 */
export interface PlatformStatus {
  status: PlatformConfigStatus
  /** 接入配置的目标文件路径 */
  path: string
}

/** 接入配置安装结果（失败时 msg 为中文原因，不抛错） */
export interface PlatformInstallResult {
  ok: boolean
  msg?: string
  /** 接入配置的目标文件路径（无论成败都返回期望路径） */
  path: string
}

/** window.preload.trafficLight 契约：红绿灯配置桥（仅伙伴窗口的独立 preload 注入，主窗口运行时不存在） */
export interface TrafficLightApi {
  /** 读取整份配置（含 lastPort 与各软件绑定） */
  getConfig(): Promise<TrafficLightConfig>
  /** 保存单个软件配置；结果由 main 校验给出（灯态唯一/软件互斥） */
  saveSoftwareConfig(
    software: SoftwareName,
    config: SoftwareLightConfig
  ): Promise<TrafficLightSaveResult>
  /** 记住上次使用的串口（伙伴窗口连接成功后调用） */
  setLastPort(path: string): Promise<void>
  /** 检查指定软件的事件接入配置状态（opencode = 插件文件与内置模板比对） */
  checkPlatform(software: SoftwareName): Promise<PlatformStatus>
  /** 安装/更新指定软件的事件接入配置（覆盖写入其插件目录） */
  installPlatform(software: SoftwareName): Promise<PlatformInstallResult>
}
