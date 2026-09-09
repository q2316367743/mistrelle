/**
 * 「权限审批」动作定义：允许 / 拒绝最近一条待审批权限请求（权限审批基座）。
 * decision 白名单校验；无待审请求时按键空操作（归一化只看 decision 合法性）。
 */
import type { KeypadPermissionAction } from '../../types/keypad'
import { isPermissionDecision } from '../../types/permissionRequest'
import type { KeypadActionDefinition } from './index'

export const permissionAction: KeypadActionDefinition<KeypadPermissionAction> = {
  type: 'permission',
  label: '权限审批',
  normalize(raw) {
    if (typeof raw.decision !== 'string' || !isPermissionDecision(raw.decision)) return null
    return { type: 'permission', decision: raw.decision }
  },
  createDefault() {
    return { type: 'permission', decision: 'allow' }
  }
}
