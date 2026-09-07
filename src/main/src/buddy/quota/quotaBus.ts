/**
 * 额度快照总线（main 进程，pub/sub）：额度是公共域，与 buddyEventBus 同构——
 * quotaService 刷新完成后只负责发布，各硬件设备（ESP32 LCD 等）在自身 init 内
 * 订阅快照并自行下发（如圆屏 writeLcdJson），新增消费设备零改动 quota 域。
 */
import type { QuotaSnapshot } from '@common/types/quota'

export type QuotaSnapshotHandler = (snapshot: QuotaSnapshot) => void | Promise<void>

const handlers = new Set<QuotaSnapshotHandler>()

/** 订阅额度快照（设备域启动初始化时调用；设备域与应用同生命周期，无退订场景） */
export function subscribeQuotaSnapshot(handler: QuotaSnapshotHandler): void {
  handlers.add(handler)
}

/** 发布一次额度快照：并发投递全部订阅方，单方失败不影响其他方 */
export async function publishQuotaSnapshot(snapshot: QuotaSnapshot): Promise<void> {
  await Promise.allSettled([...handlers].map((handler) => handler(snapshot)))
}
