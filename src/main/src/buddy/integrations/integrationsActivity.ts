/**
 * 集成调试事件流（main 进程，模块级单例，纯内存）：订阅 buddyEventBus 收合法事件，
 * 打时间戳后入内存环形缓冲并广播给渲染层（伙伴窗口懒创建，渲染层 getActivity 首拉补足窗口期）。
 * 另维护「各软件已捕获事件」集合（至少收到一次即记录，独立于缓冲上限，供卡片按事件点亮对照），
 * 清空操作把缓冲与捕获标记一并复位。仅服务「设置-应用集成」页调试展示：
 * 不落盘、不建表、重启清空，也不影响设备域消费。
 * 采集点在总线订阅侧——server 是触发节点、只做双白名单校验后发布，本模块不触碰 server。
 */
import { BrowserWindow } from 'electron'
import { IntegrationChannels } from '@common/buddy/integrations/integrationChannels'
import {
  INTEGRATION_ACTIVITY_LIMIT,
  type IntegrationActivityEntry,
  type IntegrationActivityState
} from '@common/types/integrations'
import type { BuddyEventName } from '@common/types/buddyEvent'
import type { SoftwareName } from '@common/types/trafficLight'
import { subscribeBuddyEvent } from '$/buddy/events/buddyEventBus'

/** 内存事件缓冲（时间正序，尾部追加、超限丢头部） */
const activityBuffer: IntegrationActivityEntry[] = []

/** 各软件已捕获事件（去重；独立于缓冲上限，事件即使被缓冲挤掉仍记已捕获） */
const receivedByPlatform = new Map<SoftwareName, Set<BuddyEventName>>()

/** 广播给所有窗口（伙伴窗口订阅消费，主窗口无订阅无影响） */
function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

/** 启动初始化（app ready 后调用）：订阅 buddy 事件总线并转发为渲染层事件流 */
export function initIntegrationsActivity(): void {
  subscribeBuddyEvent((platform, event) => {
    const entry: IntegrationActivityEntry = { platform, event, at: Date.now() }
    activityBuffer.push(entry)
    if (activityBuffer.length > INTEGRATION_ACTIVITY_LIMIT) {
      activityBuffer.splice(0, activityBuffer.length - INTEGRATION_ACTIVITY_LIMIT)
    }
    let received = receivedByPlatform.get(platform)
    if (!received) {
      received = new Set()
      receivedByPlatform.set(platform, received)
    }
    received.add(event)
    broadcast(IntegrationChannels.activity, entry)
  })
}

/** 读取事件流快照（缓冲时间正序，新事件在后；received 转数组） */
export function getIntegrationActivity(): IntegrationActivityState {
  return {
    entries: [...activityBuffer],
    received: Object.fromEntries(
      [...receivedByPlatform].map(([platform, events]) => [platform, [...events]])
    ) as Partial<Record<SoftwareName, BuddyEventName[]>>
  }
}

/** 清空全部事件流（缓冲与已捕获标记一并复位，内存态无需落盘） */
export function clearIntegrationActivity(): void {
  activityBuffer.length = 0
  receivedByPlatform.clear()
}
