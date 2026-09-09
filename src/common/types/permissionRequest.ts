/**
 * 权限审批基座类型契约（main / preload / renderer 跨端共享）。
 * 基座 = 待审批权限请求的登记 / 广播 / 决定回传，不感知任何业务消费者
 * （接入来源如 opencode、面板、键盘、HTTP 端点均独立挂载，依赖方向单向指向基座）。
 * 约定：每个联合 type 下方紧跟同名 Options（Array<CommonSelect<type>>）作名称映射；
 * 通道常量在 @common/buddy/permission/permissionChannels。
 */
import { CommonSelect } from './CommonSelect'

/** 审批决定（应用侧回传给接入来源的最终取向） */
export type PermissionDecision = 'allow' | 'deny'

/** 审批决定名称映射 */
export const PermissionDecisionOptions: Array<CommonSelect<PermissionDecision>> = [
  { value: 'allow', label: '允许' },
  { value: 'deny', label: '拒绝' }
]

/** 审批决定白名单校验（配置归一化与各端共用） */
export function isPermissionDecision(value: string): value is PermissionDecision {
  return value === 'allow' || value === 'deny'
}

/**
 * 请求结局（基座回给接入方挂起请求的应答）：
 * allow/deny=应用侧已决定；ask=无决定（超时 / 原生侧已先行回答），接入方回落自身默认询问流程。
 */
export type PermissionResolveStatus = 'allow' | 'deny' | 'ask'

/** 请求结局名称映射 */
export const PermissionResolveStatusOptions: Array<CommonSelect<PermissionResolveStatus>> = [
  { value: 'allow', label: '已允许' },
  { value: 'deny', label: '已拒绝' },
  { value: 'ask', label: '未决定' }
]

/** 一条待审批权限请求（由接入方投递，requestId 在基座内唯一） */
export interface PermissionRequestInfo {
  /** 基座内唯一键：sessionID + '/' + permissionId（防多实例 / 多会话碰撞） */
  requestId: string
  /** 接入方原始权限请求 ID */
  permissionId: string
  /** 权限类型（接入方语义，如 bash / edit） */
  type: string
  /** 展示标题（接入方原文） */
  title: string
  /** 关联会话 ID */
  sessionID: string
  /** 命中模式（路径 / 命令等，接入方可选） */
  pattern?: string | Array<string>
  /** 关联工具调用 ID（接入方可选） */
  callID?: string
  /** 请求产生时间（ms 时间戳） */
  createdAt: number
  /** 接入来源标识原文（如 opencode；基座不校验取值） */
  source: string
}

/** window.preload.permission 契约：权限审批基座桥（仅伙伴窗口独立 preload 注入，主窗口运行时不存在） */
export interface PermissionApi {
  /** 拉取当前全部待审批请求（懒创建后补状态用；实时以推送为准） */
  listPending(): Promise<PermissionRequestInfo[]>
  /** 回传一条请求的审批决定，返回是否命中待审项 */
  decide(requestId: string, decision: PermissionDecision): Promise<boolean>
  /** 订阅待审列表推送（任何变更全量推送）；返回取消订阅函数 */
  onPending(callback: (list: PermissionRequestInfo[]) => void): () => void
}
