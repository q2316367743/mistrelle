/**
 * window.preload.trafficLight 契约：红绿灯配置桥。
 * 与 main 的 TrafficLightService / trafficLightIpc.ts 对应；修改需与 preload 侧同步。
 * 仅伙伴窗口的独立 preload（out/preload/buddy.js）注入，主窗口运行时不存在，勿在主窗口使用。
 */

/** 灯态指令（Arduino 行协议：灯 r/g/y × 模式 o=常亮 s=闪烁） */
type LightState = 'ro' | 'rs' | 'go' | 'gs' | 'yo' | 'ys'

/** 已接入的软件（互斥启用：同一时间只允许一个软件 enabled） */
type SoftwareName = 'opencode'

/** Opencode 事件目录（只保留对信号灯有意义的 6 个，与官方事件名一致） */
type OpencodeEventName =
  | 'message.part.updated'
  | 'session.idle'
  | 'permission.asked'
  | 'session.error'
  | 'tool.execute.before'
  | 'tool.execute.after'

/** 单个软件的接入配置：启用开关 + 事件→灯态绑定（缺失 = 不响应） */
interface SoftwareLightConfig {
  enabled: boolean
  bindings: Partial<Record<OpencodeEventName, LightState>>
}

/** 红绿灯配置（落盘结构）：lastPort 记住上次串口 + 各软件配置 */
interface TrafficLightConfig {
  /** 上次使用的串口路径；未记录为空串 */
  lastPort: string
  config: Partial<Record<SoftwareName, SoftwareLightConfig>>
}

/** 保存软件配置的结果（失败时 msg 为中文原因，不抛错） */
interface TrafficLightSaveResult {
  ok: boolean
  msg?: string
}

/**
 * 软件事件接入配置状态（如 opencode 插件是否已装入其插件目录）：
 * missing=未安装；outdated=已安装但内容与内置模板不一致（可更新）；ready=已就绪。
 */
type PlatformConfigStatus = 'missing' | 'outdated' | 'ready'

/** 接入配置检查结果 */
interface PlatformStatus {
  status: PlatformConfigStatus
  /** 接入配置的目标文件路径 */
  path: string
}

/** 接入配置安装结果（失败时 msg 为中文原因，不抛错） */
interface PlatformInstallResult {
  ok: boolean
  msg?: string
  /** 接入配置的目标文件路径（无论成败都返回期望路径） */
  path: string
}

declare interface TrafficLightApi {
  /** 读取整份配置（含 lastPort 与各软件绑定） */
  getConfig(): Promise<TrafficLightConfig>
  /** 保存单个软件配置；结果由 main 校验给出（灯态唯一/软件互斥） */
  saveSoftwareConfig(software: SoftwareName, config: SoftwareLightConfig): Promise<TrafficLightSaveResult>
  /** 记住上次使用的串口（伙伴窗口连接成功后调用） */
  setLastPort(path: string): Promise<void>
  /** 检查指定软件的事件接入配置状态（opencode = 插件文件与内置模板比对） */
  checkPlatform(software: SoftwareName): Promise<PlatformStatus>
  /** 安装/更新指定软件的事件接入配置（覆盖写入其插件目录） */
  installPlatform(software: SoftwareName): Promise<PlatformInstallResult>
}
