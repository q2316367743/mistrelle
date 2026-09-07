/**
 * 应用集成域类型契约：main / preload / renderer 跨端共享。
 * 应用集成 = 外部软件（opencode 等）侧的接入配置（如内置事件插件装入其插件目录），
 * 集成后其事件才能经本地事件服务投递给 buddy 设备（红绿灯/圆屏各自做启用与绑定配置）。
 * 约定：每个 type 下方紧跟同名 Options（Array<CommonSelect<type>>）作名称映射，
 * 通道常量在 @common/buddy/integrations/integrationChannels，
 * window 挂载由渲染层 vite-env.d.ts 声明（仅伙伴窗口独立 preload 注入）。
 */
import { CommonSelect } from './CommonSelect'
import type { SoftwareName } from './trafficLight'

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

/** window.preload.integrations 契约：应用集成域桥（仅伙伴窗口的独立 preload 注入，主窗口运行时不存在） */
export interface IntegrationApi {
  /** 检查指定软件的接入配置状态（opencode = 插件文件与内置模板比对） */
  checkPlatform(software: SoftwareName): Promise<PlatformStatus>
  /** 安装/更新指定软件的接入配置（覆盖写入其插件目录） */
  installPlatform(software: SoftwareName): Promise<PlatformInstallResult>
}
