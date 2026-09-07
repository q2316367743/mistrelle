/**
 * 应用集成 IPC 通道常量（main / preload 共用）。
 * 通道命名沿用 'domain:action' 约定；域类型在 @common/types/integrations。
 * 应用集成 = 外部软件侧的接入配置检查与安装（如 opencode 内置事件插件）。
 */

export const IntegrationChannels = {
  /** 检查指定软件的接入配置是否已安装（与内置模板内容比对） */
  check: 'integrations:check',
  /** 安装/更新指定软件的接入配置（覆盖写入其插件目录） */
  install: 'integrations:install'
} as const
