/**
 * Buddy 事件白名单过滤监听器（main 进程）：原始事件总线的消费者之一。
 * platform/event 双白名单校验，命中才发布到校验后事件总线（buddyEventBus，设备域订阅消费）；
 * 未命中静默丢弃（集成调试事件流监听器负责把被丢弃的请求也展示给前端排查）。
 */
import { isBuddyEvent } from '@common/types/buddyEvent'
import { isSoftwareName } from '@common/types/trafficLight'
import { publishBuddyEvent, subscribeRawBuddyEvent } from './buddyEventBus'

/** 启动初始化（registerIpc 内调用，先于事件服务启动）：注册白名单过滤监听器 */
export function initBuddyEventFilter(): void {
  subscribeRawBuddyEvent((platform, event) => {
    if (isSoftwareName(platform) && isBuddyEvent(event)) {
      void publishBuddyEvent(platform, event)
    }
  })
}
