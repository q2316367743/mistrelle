/**
 * Buddy 事件锁存判定器（main 进程设备域共用）：抑制「锁存期内的思考类噪音事件」，
 * 防止 permission/done/ask 状态被紧随其后的流式更新覆盖——opencode 在 permission.asked、
 * session.idle 之后仍会推 message.part.updated / message.updated（含插件 500ms 节流的尾部补发）。
 * 每个设备域 createBuddyEventLatch() 各持一个独立实例，在自身映射/绑定命中路径上调用；
 * 绑定可配置的消费方（如红绿灯）须对全量事件喂入，否则未绑定的释放事件无法解锁。
 */
import type { BuddyEventName } from '@common/types/buddyEvent'

/** 锁存形态：permission/ask 无时限（等释放事件解锁）；done 只在静默窗内抑制 */
type BuddyEventLatch = { kind: 'permission' | 'ask' } | { kind: 'done'; quietUntil: number }

/** 噪音类事件（映射为 thinking 类）：锁存期内被抑制，且不改变锁存 */
const LATCH_MUTED_EVENTS: ReadonlySet<BuddyEventName> = new Set<BuddyEventName>([
  'message.part.updated',
  'message.updated',
  'command.executed'
])

/** 释放类事件（真实活动边界）：解除现有锁存；其中 asked/before/idle 随后立即立新锁 */
const LATCH_RELEASE_EVENTS: ReadonlySet<BuddyEventName> = new Set<BuddyEventName>([
  'permission.replied',
  'tool.execute.before',
  'tool.execute.after',
  'permission.asked',
  'session.created',
  'session.idle',
  'session.error'
])

/** done 静默窗时长：覆盖实测 +222~504ms 的收尾事件与插件 500ms 节流尾部补发 */
const DONE_QUIET_MS = 1500

/**
 * 创建独立锁存实例。返回 feed(event)：true = 该事件是锁存期内的噪音，设备应跳过状态下发；
 * false = 放行（锁存可能已随本事件更新）。元数据类事件（不在任何语义集合中）直接放行且不触碰锁存。
 */
export function createBuddyEventLatch(): (event: BuddyEventName) => boolean {
  let latch: BuddyEventLatch | null = null
  return (event) => {
    const muted =
      latch !== null &&
      LATCH_MUTED_EVENTS.has(event) &&
      (latch.kind !== 'done' || Date.now() < latch.quietUntil)
    if (muted) return true
    if (LATCH_RELEASE_EVENTS.has(event)) latch = null
    if (event === 'permission.asked' || event === 'permission.updated') {
      latch = { kind: 'permission' }
    } else if (event === 'tool.execute.before') {
      latch = { kind: 'ask' }
    } else if (event === 'session.idle') {
      latch = { kind: 'done', quietUntil: Date.now() + DONE_QUIET_MS }
    }
    return false
  }
}
