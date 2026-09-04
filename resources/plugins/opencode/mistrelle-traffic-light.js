/**
 * Mistrelle 红绿灯接入插件（opencode）
 * 监听 opencode 事件，经 mistrelle://buddy/traffic-light 投递给 mistrelle 桌面端，
 * 由其按用户配置映射为信号灯状态。
 * 投递双通道（同一条 URL 字符串，main 侧单一处理函数）：
 * 1. 主通道 = 本地 socket：直连写入一行 URL 即断，不经系统唤起、不抢焦点，应用未运行时事件丢弃（灯灭语义）；
 * 2. 兜底 = 系统深链：仅 socket 不可达且 main 在跑时使用，darwin 加 -g 后台投递避免抢焦点。
 * 安装位置：~/.config/opencode/plugins/（opencode 官方全局插件目录，启动自动加载，无需注册 opencode.json）。
 */

import { connect } from 'node:net'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
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

/** 同一事件的最小投递间隔（ms）：兜底深链路径要 spawn 进程，防止进程风暴 */
const THROTTLE_MS = 500

// 与 main 侧 src/main/src/app/protocol.ts 的 eventSocketPath 保持一致（模板是独立文件，无法 import）
const SOCKET_PATH =
  process.platform === 'win32'
    ? '\\\\.\\pipe\\mistrelle-traffic-light'
    : `${homedir()}/.mistrelle/buddy/traffic-light.sock`

/** 主通道：本地 socket 直连 main，写入与深链完全相同的 URL 字符串即断；失败不抛错，返回是否成功 */
function sendViaSocket(url) {
  return new Promise((resolve) => {
    const client = connect(SOCKET_PATH, () => {
      client.write(`${url}\n`)
      client.end()
      resolve(true)
    })
    client.on('error', () => resolve(false))
    client.setTimeout(1000, () => {
      client.destroy()
      resolve(false)
    })
  })
}

/** 兜底通道：系统深链唤起（detached + unref 即发即忘，信号灯是旁路反馈，失败不影响 opencode） */
function openDeepLink(url) {
  let child
  if (process.platform === 'darwin') {
    // -g 后台投递：裸 open 会把 mistrelle 激活到前台抢焦点
    child = spawn('open', ['-g', url], { detached: true, stdio: 'ignore' })
  } else if (process.platform === 'win32') {
    child = spawn('rundll32', ['url.dll,FileProtocolHandler', url], { detached: true, stdio: 'ignore' })
  } else {
    child = spawn('xdg-open', [url], { detached: true, stdio: 'ignore' })
  }
  child.unref()
}

/** socket 文件在 = main 在跑；不在 = 应用未起，事件丢弃（灯灭语义），避免深链把应用冷启动拉到前台 */
function isMainAlive() {
  try {
    return existsSync(SOCKET_PATH)
  } catch {
    return false
  }
}

/** 投递出口：主通道失败且 main 在跑时才退深链 */
function sendEvent(url) {
  sendViaSocket(url).then((sent) => {
    if (!sent && isMainAlive()) openDeepLink(url)
  })
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
      sendEvent(url)
      return
    }
    // 节流窗口内的重复事件只排一次尾部补发，保证最终灯态不丢
    if (trailing.has(type)) return
    const timer = setTimeout(() => {
      trailing.delete(type)
      lastSentAt.set(type, Date.now())
      sendEvent(url)
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
