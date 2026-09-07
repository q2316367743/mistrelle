/**
 * 应用集成 IPC 通道常量（main / preload 共用）。
 * 通道命名沿用 'domain:action' 约定；域类型在 @common/types/integrations。
 * 应用集成 = 外部软件侧的接入配置检查与安装（如 opencode 内置事件插件）；
 * activity 通道为集成调试事件流（纯内存展示，不落盘）。
 */

export const IntegrationChannels = {
  /** 检查指定软件的接入配置是否已安装（与内置模板内容比对） */
  check: 'integrations:check',
  /** 安装/更新指定软件的接入配置（覆盖写入其插件目录） */
  install: 'integrations:install',
  /** 拉取调试事件流（全量缓冲，含未命中白名单被丢弃的请求） */
  getActivity: 'integrations:getActivity',
  /** 清空全部调试事件流 */
  clearActivity: 'integrations:clearActivity',
  /** 主进程 → 渲染层：一条新集成事件（含未命中白名单的） */
  activity: 'integrations:activity'
} as const
