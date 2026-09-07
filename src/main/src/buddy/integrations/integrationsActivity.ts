/**
 * 集成调试事件流（main 进程，模块级单例，纯内存）：原始事件总线的全量监听器之一——
 * /buddy/event 收到的每条请求（含未命中白名单被丢弃的）打时间戳、按双白名单打 accepted 标记
 * （仅供前端着色：命中绿字 / 丢弃灰字），入内存环形缓冲并广播给渲染层
 * （伙伴窗口懒创建，渲染层 getActivity 首拉补足窗口期）。
 * 仅服务「设置-应用集成」页调试展示：不落盘、不建表、重启清空，也不影响设备域消费。
 */
import { BrowserWindow } from 'electron'
import { IntegrationChannels } from '@common/buddy/integrations/integrationChannels'
import {
  INTEGRATION_ACTIVITY_LIMIT,
  type IntegrationActivityEntry
} from '@common/types/integrations'
import { isBuddyEvent } from '@common/types/buddyEvent'
import { isSoftwareName } from '@common/types/trafficLight'
import { subscribeRawBuddyEvent } from '$/buddy/events/buddyEventBus'

/** 内存事件缓冲（时间正序，尾部追加、超限丢头部） */
const activityBuffer: IntegrationActivityEntry[] = []

/** 广播给所有窗口（伙伴窗口订阅消费，主窗口无订阅无影响） */
function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

/** 启动初始化（registerIpc 内调用，先于事件服务启动）：全量监听原始事件并转发渲染层 */
export function initIntegrationsActivity(): void {
  subscribeRawBuddyEvent((platform, event) => {
    const entry: IntegrationActivityEntry = {
      platform,
      event,
      accepted: isSoftwareName(platform) && isBuddyEvent(event),
      at: Date.now()
    }
    activityBuffer.push(entry)
    if (activityBuffer.length > INTEGRATION_ACTIVITY_LIMIT) {
      activityBuffer.splice(0, activityBuffer.length - INTEGRATION_ACTIVITY_LIMIT)
    }
    broadcast(IntegrationChannels.activity, entry)
  })
}

/** 读取事件流副本（时间正序，新事件在后，含被丢弃的请求） */
export function getIntegrationActivity(): IntegrationActivityEntry[] {
  return [...activityBuffer]
}

/** 清空全部事件流（内存态，重启自然清空） */
export function clearIntegrationActivity(): void {
  activityBuffer.length = 0
}
