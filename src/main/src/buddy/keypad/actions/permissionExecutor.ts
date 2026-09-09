/**
 * 「权限审批」动作执行器：设备按下时对最近一条待审批权限请求回传决定（允许/拒绝）。
 * 无待审请求时空操作（不报错不打扰）；权限基座见 buddy/permission/permissionService。
 */
import type { KeypadPermissionAction } from '@common/types/keypad'
import { decidePermission, listPendingPermissions } from '$/buddy/permission/permissionService'
import type { KeypadActionExecutor } from './index'

export const permissionExecutor: KeypadActionExecutor<KeypadPermissionAction> = {
  onPress: (action) => {
    const [latest] = listPendingPermissions()
    if (!latest) return
    decidePermission(latest.requestId, action.decision)
  }
}
