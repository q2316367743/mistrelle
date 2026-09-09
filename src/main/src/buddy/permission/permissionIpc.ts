/**
 * 权限审批基座 IPC handler（main 进程）：待审列表拉取与决定回传。
 * 消费者面入口；接入方走本地事件服务 HTTP（server/index.ts），不经 IPC。
 */
import { ipcMain } from 'electron'
import { PermissionChannels } from '@common/buddy/permission/permissionChannels'
import type { PermissionDecision, PermissionRequestInfo } from '@common/types/permissionRequest'
import { decidePermission, listPendingPermissions } from './permissionService'

export function registerPermissionIpc(): void {
  ipcMain.handle(PermissionChannels.list, (): PermissionRequestInfo[] => listPendingPermissions())
  ipcMain.handle(
    PermissionChannels.decide,
    (_event, requestId: string, decision: PermissionDecision): boolean =>
      decidePermission(requestId, decision)
  )
}
