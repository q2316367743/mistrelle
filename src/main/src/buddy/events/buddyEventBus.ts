/**
 * Buddy 事件总线（main 进程，pub/sub），两条总线：
 * 1. 原始事件总线（raw）：本地事件服务收到 /buddy/event 即发布完整原始事件（零校验），
 *    监听器各取所需——白名单过滤（buddyEventFilter，命中发布到校验后总线）与
 *    集成调试事件流（integrationsActivity，全量转发伙伴窗口展示）。
 * 2. 校验后事件总线（typed）：仅承载命中白名单的事件，业务方（红绿灯 / ESP32 LCD 等
 *    buddy 设备）在各自 init 时订阅消费——新增设备 = 新域服务 init 内 subscribe。
 * server 与总线零校验、零业务依赖。
 */
import type { BuddyEventName } from '@common/types/buddyEvent'
import type { SoftwareName } from '@common/types/trafficLight'

/** 原始事件监听器：platform/event 为请求原文（未校验） */
export type RawBuddyEventHandler = (platform: string, event: string) => void | Promise<void>

const rawHandlers = new Set<RawBuddyEventHandler>()

/** 订阅原始 buddy 事件（全量、含未命中白名单的；init 时注册，当前无退订场景） */
export function subscribeRawBuddyEvent(handler: RawBuddyEventHandler): void {
  rawHandlers.add(handler)
}

/** 发布一条原始 buddy 事件：并发投递全部订阅方，单方失败不影响其他方 */
export async function publishRawBuddyEvent(platform: string, event: string): Promise<void> {
  await Promise.allSettled([...rawHandlers].map((handler) => handler(platform, event)))
}

export type BuddyEventHandler = (
  platform: SoftwareName,
  event: BuddyEventName
) => void | Promise<void>

const handlers = new Set<BuddyEventHandler>()

/** 订阅 buddy 事件（校验后；域服务启动初始化时调用；当前无退订场景，设备域与应用同生命周期） */
export function subscribeBuddyEvent(handler: BuddyEventHandler): void {
  handlers.add(handler)
}

/** 发布一条 buddy 事件（由白名单过滤监听器在命中后发布）：并发投递全部订阅方，单方失败不影响其他方 */
export async function publishBuddyEvent(
  platform: SoftwareName,
  event: BuddyEventName
): Promise<void> {
  await Promise.allSettled([...handlers].map((handler) => handler(platform, event)))
}
