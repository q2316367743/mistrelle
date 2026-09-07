/**
 * Mistrelle 应用集成插件（opencode）
 * 监听 opencode 事件，经本地事件服务 HTTP 接口投递给 mistrelle 桌面端，
 * 由其分发给 buddy 设备（红绿灯按用户配置映射灯态、ESP32 LCD 屏转发显示）。
 * 投递 = fetch GET http://127.0.0.1:47743/buddy/event?platform=…&event=…，
 * event 只允许 Mistrelle 设计的 Buddy 事件词汇表（白名单，与 mistrelle 端
 * src/common/types/buddyEvent.ts 的全集一致），不是 opencode 原生事件名直传。
 * 不经系统唤起、不抢焦点、不拉起进程；应用未运行时投递失败静默丢弃（灯灭语义，绝不冷启动拉起应用）。
 * 安装位置：~/.config/opencode/plugins/（opencode 官方全局插件目录，启动自动加载，无需注册 opencode.json）。
 * 由 mistrelle「设置-应用集成」页一键安装（曾用名 mistrelle-traffic-light.js，安装时自动清理旧名残留）。
 */

/** 本地事件服务地址（与 mistrelle 端 src/common/server/eventServer.ts 的 EVENT_SERVER_ORIGIN 保持一致；
 *  模板是独立文件无法 import，改动端口需两处同步） */
const SERVER_ORIGIN = 'http://127.0.0.1:47743'

/** Buddy 事件词汇表白名单（opencode bus 事件蓝本，与 mistrelle 端 BuddyEventName 全集一致；
 *  命中才投递，未收录的原生事件不转发） */
const EVENTS = new Set([
  'session.created',
  'session.updated',
  'session.deleted',
  'session.diff',
  'session.status',
  'session.idle',
  'session.compacted',
  'session.error',
  'message.updated',
  'message.removed',
  'message.part.updated',
  'message.part.removed',
  'file.edited',
  'file.watcher.updated',
  'permission.asked',
  'permission.updated',
  'permission.replied',
  'tool.execute.before',
  'tool.execute.after',
  'command.executed',
  'todo.updated',
  'pty.exited',
  'vcs.branch.updated',
  'installation.update.available'
])

/** 同一事件的最小投递间隔（ms）：message.part.updated 流式高频，防止请求风暴 */
const THROTTLE_MS = 500

/** 投递一条事件（route 含 query，如 buddy/event?platform=…&event=…）；失败静默丢弃 */
async function sendEvent(route) {
  try {
    const res = await fetch(`${SERVER_ORIGIN}/${route}`, { signal: AbortSignal.timeout(1000) })
    if (res.ok) return
  } catch {
    // 应用未运行 / 服务不可达：buddy 设备是旁路反馈，直接丢弃，不影响 opencode 主流程
  }
}

export const MistrelleIntegration = async () => {
  /** 每事件独立节流：上次投递时间 + 尾部补发定时器 */
  const lastSentAt = new Map()
  const trailing = new Map()

  function forward(type) {
    const route = `buddy/event?platform=opencode&event=${encodeURIComponent(type)}`
    const now = Date.now()
    const last = lastSentAt.get(type) ?? 0
    if (now - last >= THROTTLE_MS) {
      lastSentAt.set(type, now)
      void sendEvent(route)
      return
    }
    // 节流窗口内的重复事件只排一次尾部补发，保证最终状态不丢
    if (trailing.has(type)) return
    const timer = setTimeout(() => {
      trailing.delete(type)
      lastSentAt.set(type, Date.now())
      void sendEvent(route)
    }, THROTTLE_MS - (now - last))
    trailing.set(type, timer)
  }

  return {
    event: async ({ event }) => {
      const type = event?.type
      if (!type || !EVENTS.has(type)) return
      try {
        forward(type)
      } catch {
        // 静默：投递失败不影响 opencode 主流程
      }
    }
  }
}
