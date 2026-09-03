/**
 * Mistrelle 红绿灯接入插件（opencode）
 * 监听 opencode 事件，经系统深链 mistrelle://buddy/traffic-light 投递给 mistrelle 桌面端，
 * 由其按用户配置映射为信号灯状态。
 * 安装位置：~/.config/opencode/plugins/（opencode 官方全局插件目录，启动自动加载，无需注册 opencode.json）。
 */

import { spawn } from 'node:child_process'

/** 只转发对信号灯有意义的事件（与 mistrelle 端 OpencodeEventName 全集一致） */
const EVENTS = new Set([
  'message.part.updated',
  'session.idle',
  'permission.asked',
  'session.error',
  'tool.execute.before',
  'tool.execute.after'
])

/** 同一事件的最小投递间隔（ms）：message.part.updated 流式高频，防止深链进程风暴 */
const THROTTLE_MS = 500

/** 按平台唤起深链；detached + unref 即发即忘，信号灯是旁路反馈，失败不影响 opencode */
function openDeepLink(url) {
  let child
  if (process.platform === 'darwin') {
    child = spawn('open', [url], { detached: true, stdio: 'ignore' })
  } else if (process.platform === 'win32') {
    child = spawn('rundll32', ['url.dll,FileProtocolHandler', url], { detached: true, stdio: 'ignore' })
  } else {
    child = spawn('xdg-open', [url], { detached: true, stdio: 'ignore' })
  }
  child.unref()
}

export const MistrelleTrafficLight = async () => {
  /** 每事件独立节流：上次投递时间 + 尾部补发定时器 */
  const lastSentAt = new Map()
  const trailing = new Map()

  function forward(type) {
    const url = `mistrelle://buddy/traffic-light?platform=opencode&event=${encodeURIComponent(type)}`
    const now = Date.now()
    const last = lastSentAt.get(type) ?? 0
    if (now - last >= THROTTLE_MS) {
      lastSentAt.set(type, now)
      openDeepLink(url)
      return
    }
    // 节流窗口内的重复事件只排一次尾部补发，保证最终灯态不丢
    if (trailing.has(type)) return
    const timer = setTimeout(() => {
      trailing.delete(type)
      lastSentAt.set(type, Date.now())
      openDeepLink(url)
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
