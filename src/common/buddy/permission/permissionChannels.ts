/**
 * 权限审批基座 IPC 通道常量（main / preload 共用）。
 * 通道命名沿用 'domain:action' 约定；域类型在 @common/types/permissionRequest。
 * 基座只提供登记 / 广播 / 决定回传，不感知消费者；接入适配（如 opencode 插件的
 * HTTP 路由）与业务消费者（面板 / 键盘 / 外部脚本）各自独立挂载。
 */

export const PermissionChannels = {
  /** 拉取当前全部待审批请求（窗口懒创建后补状态） */
  list: 'permission:list',
  /** 回传一条请求的审批决定（渲染层 / 外部 HTTP 均落到基座同一函数） */
  decide: 'permission:decide',
  /** 主进程 → 渲染层：待审批请求全量列表（任何变更整体推送） */
  pending: 'permission:pending'
} as const
