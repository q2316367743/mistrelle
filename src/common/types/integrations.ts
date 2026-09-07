/**
 * 应用集成域类型契约：main / preload / renderer 跨端共享。
 * 应用集成 = 外部软件（opencode 等）侧的接入配置（如内置事件插件装入其插件目录），
 * 集成后其事件才能经本地事件服务投递给 buddy 设备（红绿灯/圆屏各自做启用与绑定配置）。
 * 约定：每个 type 下方紧跟同名 Options（Array<CommonSelect<type>>）作名称映射，
 * 通道常量在 @common/buddy/integrations/integrationChannels，
 * window 挂载由渲染层 vite-env.d.ts 声明（仅伙伴窗口独立 preload 注入）。
 */
import { CommonSelect } from './CommonSelect'
import type { BuddyEventName } from './buddyEvent'
import type { SoftwareName } from './trafficLight'

/** 调试事件流内存上限（纯展示、不落盘，超限丢最旧） */
export const INTEGRATION_ACTIVITY_LIMIT = 200

/**
 * 接入配置状态（如 opencode 插件是否已装入其插件目录）：
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

export interface IntegrationActivityEntry {
  platform: SoftwareName
  event: BuddyEventName
  /** 事件时间（ms 时间戳，main 收到后打点） */
  at: number
}

/** 调试事件流快照（getActivity 返回） */
export interface IntegrationActivityState {
  /** 事件流缓冲（时间正序，新事件在后；上限 INTEGRATION_ACTIVITY_LIMIT） */
  entries: IntegrationActivityEntry[]
  /** 各软件已捕获事件（至少收到一次；独立于缓冲上限，清空时一起复位） */
  received: Partial<Record<SoftwareName, BuddyEventName[]>>
}

/** window.preload.integrations 契约：应用集成域桥（仅伙伴窗口的独立 preload 注入，主窗口运行时不存在） */
export interface IntegrationApi {
  /** 检查指定软件的接入配置状态（opencode = 插件文件与内置模板比对） */
  checkPlatform(software: SoftwareName): Promise<PlatformStatus>
  /** 安装/更新指定软件的接入配置（覆盖写入其插件目录） */
  installPlatform(software: SoftwareName): Promise<PlatformInstallResult>
  /** 拉取调试事件流快照（纯内存缓冲 + 各软件已捕获事件；重启清空） */
  getActivity(): Promise<IntegrationActivityState>
  /** 清空全部调试事件流与已捕获标记（调用方在成功后同步复位本地状态） */
  clearActivity(): Promise<void>
  /** 订阅实时调试事件流推送；返回取消订阅函数 */
  onActivity(callback: (entry: IntegrationActivityEntry) => void): () => void
}
