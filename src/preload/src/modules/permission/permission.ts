/**
 * 权限审批基座桥（preload）：待审列表拉取 / 决定回传 / 实时推送订阅的 IPC 薄封装。
 * 基座逻辑都在 main（buddy/permission/permissionService）；消费者（面板 / 键盘 / 脚本）各自独立挂载。
 */
import { ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { PermissionChannels } from '@common/buddy/permission/permissionChannels'
import type { PermissionDecision, PermissionRequestInfo } from '@common/types/permissionRequest'

export const permissionApi = {
  /** 拉取当前全部待审批请求（懒创建后补状态用；实时以推送为准） */
  listPending: (): Promise<PermissionRequestInfo[]> => ipcRenderer.invoke(PermissionChannels.list),
  /** 回传一条请求的审批决定，返回是否命中待审项 */
  decide: (requestId: string, decision: PermissionDecision): Promise<boolean> =>
    ipcRenderer.invoke(PermissionChannels.decide, requestId, decision),
  /** 订阅待审列表推送（任何变更全量推送）；返回取消订阅函数 */
  onPending: (callback: (list: PermissionRequestInfo[]) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, list: PermissionRequestInfo[]): void => callback(list)
    ipcRenderer.on(PermissionChannels.pending, listener)
    return () => {
      ipcRenderer.removeListener(PermissionChannels.pending, listener)
    }
  }
}
