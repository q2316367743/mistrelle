/**
 * 权限审批基座（main 进程单例，纯内存不落盘）：
 * 接入方（如 opencode 插件经本地事件服务 HTTP）投递待审批请求 → 登记并全量广播，
 * 任何消费者（窗口面板 / 键盘动作 / 外部 HTTP 端点）回传决定后唤醒挂起的接入请求。
 * 基座不感知接入来源与消费者（依赖方向单向指向本模块）；
 * 超时无决定回 'ask'，由接入方回落自身默认询问流程，保证不会两不管。
 */
import { BrowserWindow } from 'electron'
import { PermissionChannels } from '@common/buddy/permission/permissionChannels'
import type {
  PermissionDecision,
  PermissionRequestInfo,
  PermissionResolveStatus
} from '@common/types/permissionRequest'

/** 无决定兜底时限：超时移除并回 'ask'（原生询问流程仍在，用户可继续在接入方侧回答） */
const PENDING_TIMEOUT_MS = 4.5 * 60 * 1000

interface PendingEntry {
  info: PermissionRequestInfo
  promise: Promise<PermissionResolveStatus>
  resolve: (status: PermissionResolveStatus) => void
  timer: NodeJS.Timeout
}

/** requestId → 挂起条目 */
const pending = new Map<string, PendingEntry>()

/** main 进程内消费者订阅（如未来 LCD 屏显内容），列表变更时收到全量快照 */
const listeners = new Set<(list: PermissionRequestInfo[]) => void>()

/** 当前全部待审批请求（按产生时间升序） */
export function listPendingPermissions(): PermissionRequestInfo[] {
  return [...pending.values()].map((entry) => entry.info).sort((a, b) => a.createdAt - b.createdAt)
}

/** 全量广播：所有窗口（IPC push）+ main 内订阅者 */
function broadcast(): void {
  const list = listPendingPermissions()
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(PermissionChannels.pending, list)
  }
  for (const listener of listeners) listener(list)
}

/** 结算一条挂起请求（decide / cancel / 超时共用唯一出口），返回是否命中 */
function settle(requestId: string, status: PermissionResolveStatus): boolean {
  const entry = pending.get(requestId)
  if (!entry) return false
  clearTimeout(entry.timer)
  pending.delete(requestId)
  entry.resolve(status)
  broadcast()
  return true
}

/**
 * 接入方投递一条待审批请求：登记并广播，返回等决定的挂起 Promise（由 HTTP 响应承载）。
 * 同一 requestId 重复投递幂等：复用同一挂起 Promise，不重复入列。
 */
export function ingestPermission(
  info: Omit<PermissionRequestInfo, 'source'>,
  source: string
): Promise<PermissionResolveStatus> {
  const existed = pending.get(info.requestId)
  if (existed) return existed.promise
  let resolve!: (status: PermissionResolveStatus) => void
  const promise = new Promise<PermissionResolveStatus>((res) => {
    resolve = res
  })
  const timer = setTimeout(() => {
    void settle(info.requestId, 'ask')
  }, PENDING_TIMEOUT_MS)
  pending.set(info.requestId, { info: { ...info, source }, promise, resolve, timer })
  broadcast()
  return promise
}

/** 消费者回传审批决定（渲染层 IPC 与外部 HTTP 端点均落到这里），返回是否命中待审项 */
export function decidePermission(requestId: string, decision: PermissionDecision): boolean {
  return settle(requestId, decision)
}

/** 接入方侧已先行回答（原生终端回答 / 自动接受等），撤下待审项并按 'ask' 结算 */
export function cancelPermission(requestId: string): boolean {
  return settle(requestId, 'ask')
}

/** main 内消费者订阅待审列表变更；返回取消订阅函数 */
export function subscribePermissions(listener: (list: PermissionRequestInfo[]) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
