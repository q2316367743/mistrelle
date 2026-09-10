/**
 * Mistrelle 应用集成钩子（权限审批双向流 · zcode / claude / codex 三平台共用）
 * 三家的 PermissionRequest 都是一等阻塞钩子：只在权限结果需要询问时触发，钩子进程
 * 挂起期间原生询问等待，stdout 输出决策 JSON 即可直接代答（三家输出契约同源：
 * hookSpecificOutput.hookEventName = 'PermissionRequest' + decision.behavior），
 * 空输出则回落原生询问。
 * 流程：异步投递 permission.asked（驱动红绿灯）→ 阻塞 POST mistrelle 权限面挂起等
 * 决定（面板/小键盘/HTTP 任一结算）→ allow/deny 输出决策代答；'ask'（mistrelle 端
 * 超时/无人处理）或任何失败静默退出（空 stdout），宿主 CLI 原生询问兜底，绝不外抛阻塞。
 * 残留待审项无需回传撤下：mistrelle 基座自带 4.5min 超时收场（三层收场兜底）。
 */

/** 本地事件服务地址（与 forward.mjs / mistrelle 端 eventServer.ts 保持一致） */
const SERVER_ORIGIN = 'http://127.0.0.1:47743'

/** 允许投递的平台（与 forward.mjs 白名单保持一致） */
const PLATFORMS = new Set(['zcode', 'claude', 'codex'])

/** 权限审批挂起上限（ms）：mistrelle 端 4.5min 先行超时回 'ask'，此为网络层兜底 */
const PERMISSION_TIMEOUT_MS = 5 * 60 * 1000

/** 读取 stdin 全量（宿主 CLI 以一行 JSON 写入后关闭） */
async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf-8')
}

/** 异步投递灯态事件（不等待、失败静默） */
function forwardAsked(platform) {
  const route = `buddy/event?platform=${encodeURIComponent(platform)}&event=permission.asked`
  return fetch(`${SERVER_ORIGIN}/${route}`, { signal: AbortSignal.timeout(1000) }).catch(() => {})
}

/**
 * 投递 asked 并挂起等 mistrelle 侧决定；返回 'allow' | 'deny' | 'ask'（含任何失败，
 * 'ask' 一律回落原生询问）。
 */
async function askApproval(platform, input) {
  try {
    const res = await fetch(`${SERVER_ORIGIN}/buddy/permission/ask?source=${encodeURIComponent(platform)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        permissionId: input.tool_use_id,
        sessionID: input.session_id,
        type: input.tool_name ?? '',
        title: input.tool_name ?? '',
        callID: input.tool_use_id,
        createdAt: Date.now()
      }),
      signal: AbortSignal.timeout(PERMISSION_TIMEOUT_MS)
    })
    if (!res.ok) return 'ask'
    const data = await res.json()
    if (data?.status === 'allow' || data?.status === 'deny') return data.status
    return 'ask'
  } catch {
    return 'ask'
  }
}

/** 输出 PermissionRequest 决策（deny 的 message 回传给模型说明拒绝原因） */
function printDecision(status) {
  const decision = { behavior: status }
  if (status === 'deny') decision.message = '该工具调用已由 Mistrelle 侧审批拒绝'
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision } })
  )
}

try {
  const platform = process.argv[2]
  if (!platform || !PLATFORMS.has(platform)) process.exit(0)
  const input = JSON.parse(await readStdin())
  if (!input?.tool_use_id || !input?.session_id) process.exit(0)
  void forwardAsked(platform)
  const status = await askApproval(platform, input)
  if (status !== 'ask') printDecision(status)
} catch {
  // 静默退出（空 stdout）→ 宿主 CLI 原生询问兜底
}
