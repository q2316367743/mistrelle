/**
 * Mistrelle 应用集成钩子（事件转发 · zcode / claude / codex 三平台共用）
 * 三家 CLI 的 hooks 机制同源（仿 Claude Code）：每次事件以独立子进程运行本脚本，
 * stdin 收一行 JSON（hook_event_name / source / tool_name 等），本脚本把原生钩子
 * 映射为 Mistrelle Buddy 事件词汇表后，经本地事件服务 HTTP 投递给桌面端，由其
 * 分发给 buddy 设备（红绿灯按用户配置映射灯态、ESP32 LCD 屏转发显示）。
 *
 * 平台名由 hooks 配置以命令行参数传入（argv[2]，与安装目录一致），防止脚本被
 * 其他渠道误用时事件归属错乱。hooks 配置中以 type:"command" 挂载——本脚本只做
 * 一次本地 fetch 即退，开销约等于 node 启动；config 条目带 timeout 防挂兜底。
 * 投递失败静默丢弃（灯灭语义，绝不影响宿主 CLI 主流程）。不做节流：每次钩子是
 * 独立进程无共享状态，且三家均无流式高频钩子，本地 GET 足以承受。
 * 由 mistrelle「设置-应用集成」页一键安装（脚本装于 ~/.mistrelle/integrations/<平台>/）。
 */

/** 本地事件服务地址（与 mistrelle 端 src/common/server/eventServer.ts 的 EVENT_SERVER_ORIGIN
 *  保持一致；模板是独立文件无法 import，改动端口需两处同步） */
const SERVER_ORIGIN = 'http://127.0.0.1:47743'

/** 允许投递的平台（与 mistrelle 端 SoftwareName 的 hooks 系成员保持一致） */
const PLATFORMS = new Set(['zcode', 'claude', 'codex'])

/** 文件编辑类工具名（PostToolUse 命中时加发 file.edited；三家编辑工具命名一致） */
const EDIT_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'apply_patch'])

/** 读取 stdin 全量（宿主 CLI 以一行 JSON 写入后关闭） */
async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf-8')
}

/** 投递一条 Buddy 事件；失败静默丢弃 */
function sendEvent(platform, event) {
  const route = `buddy/event?platform=${encodeURIComponent(platform)}&event=${encodeURIComponent(event)}`
  return fetch(`${SERVER_ORIGIN}/${route}`, { signal: AbortSignal.timeout(1000) }).catch(() => {})
}

/** 原生钩子 → Buddy 事件映射（一个钩子可映射为零或多条；未收录钩子返回空） */
function mapEvents(input) {
  switch (input?.hook_event_name) {
    case 'SessionStart':
      return [input.source === 'compact' ? 'session.compacted' : 'session.created']
    case 'UserPromptSubmit':
      return ['message.updated']
    case 'PreToolUse':
      return ['tool.execute.before']
    case 'PostToolUse':
    case 'PostToolUseFailure':
      return EDIT_TOOLS.has(input.tool_name)
        ? ['tool.execute.after', 'file.edited']
        : ['tool.execute.after']
    case 'Stop':
      return ['session.idle']
    default:
      return []
  }
}

try {
  const platform = process.argv[2]
  if (!platform || !PLATFORMS.has(platform)) process.exit(0)
  const input = JSON.parse(await readStdin())
  await Promise.all(mapEvents(input).map((event) => sendEvent(platform, event)))
} catch {
  // 旁路增强：任何失败静默退出（exit 0），不影响宿主 CLI 会话
}
