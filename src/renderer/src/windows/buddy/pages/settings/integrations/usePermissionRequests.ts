/**
 * 待审批权限请求状态（模块级单例）：消费权限审批基座（main buddy/permission）。
 * 首拉补窗口懒创建前的待审项 + 订阅全量推送；decide 回传决定后以推送刷新列表。
 * 基座消费者之一，与 integrations 业务状态（useIntegrations）互不依赖。
 */
import type { PermissionDecision, PermissionRequestInfo } from '@common/types/permissionRequest'
import { MessageUtil } from '@/utils/modal'

/** 当前全部待审批请求（基座任何变更全量推送） */
const pending = ref<PermissionRequestInfo[]>([])

let initialized = false

/** 回传审批决定；未命中说明已被他端处理（列表会经推送自动收敛） */
async function decide(requestId: string, decision: PermissionDecision): Promise<void> {
  const hit = await window.preload.permission.decide(requestId, decision)
  if (!hit) MessageUtil.warning('该请求已被处理')
}

export function usePermissionRequests() {
  if (!initialized) {
    initialized = true
    void window.preload.permission.listPending().then((list) => {
      pending.value = list
    })
    window.preload.permission.onPending((list) => {
      pending.value = list
    })
  }
  return { pending, decide }
}
