/**
 * Buddy 事件总线（main 进程，pub/sub）：本地事件服务只做协议校验与发布，
 * 业务方（红绿灯 / ESP32 LCD 等 buddy 设备）在各自 init 时订阅消费——
 * 新增设备 = 新域服务 init 内 subscribe，server 与总线零业务依赖。
 */
import type { BuddyEventName } from '@common/types/buddyEvent'
import type { SoftwareName } from '@common/types/trafficLight'

export type BuddyEventHandler = (
  platform: SoftwareName,
  event: BuddyEventName
) => void | Promise<void>

const handlers = new Set<BuddyEventHandler>()

/** 订阅 buddy 事件（域服务启动初始化时调用；当前无退订场景，设备域与应用同生命周期） */
export function subscribeBuddyEvent(handler: BuddyEventHandler): void {
  handlers.add(handler)
}

/** 发布一条 buddy 事件：并发投递全部订阅方，单方失败不影响其他方 */
export async function publishBuddyEvent(
  platform: SoftwareName,
  event: BuddyEventName
): Promise<void> {
  await Promise.allSettled([...handlers].map((handler) => handler(platform, event)))
}
