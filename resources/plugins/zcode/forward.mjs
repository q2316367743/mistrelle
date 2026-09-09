/**
 * Mistrelle 应用集成钩子（ZCode · 事件转发）
 * ZCode hooks 机制：每次事件以独立子进程运行本脚本，stdin 收一行 JSON
 * （hook_event_name / source / tool_name 等），本脚本把 ZCode 原生钩子映射为
 * Mistrelle Buddy 事件词汇表后，经本地事件服务 HTTP 投递给桌面端，由其分发给
 * buddy 设备（红绿灯按用户配置映射灯态、ESP32 LCD 屏转发显示）。
 *
 * hooks 配置中以 type:"command" + async:true 挂载（fire-and-forget，不阻塞会话）；
 * 投递失败静默丢弃（灯灭语义，绝不影响 zcode 主流程）。不做节流：每次钩子是独立
 * 进程无共享状态，且 ZCode 无流式高频钩子，本地 GET 足以承受。
 * 由 mistrelle「设置-应用集成」页一键安装（脚本装于 ~/.mistrelle/integrations/zcode/，
 * hooks 配置合并写入 ~/.zcode/cli/config.json，新会话生效）。
 */

/** 本地事件服务地址（与 mistrelle 端 src/common/server/eventServer.ts 的 EVENT_SERVER_ORIGIN
 *  保持一致；模板是独立文件无法 import，改动端口需两处同步） */
const SERVER_ORIGIN = 'http://127.0.0.1:47743'

/** ZCode 文件编辑类工具名（PostToolUse 命中时加发 file.edited） */
const EDIT_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit'])

/** 读取 stdin 全量（ZCode 以一行 JSON 写入后关闭） */
async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf-8')
}

/** 投递一条 Buddy 事件；失败静默丢弃 */
function sendEvent(event) {
  const route = `buddy/event?platform=zcode&event=${encodeURIComponent(event)}`
  return fetch(`${SERVER_ORIGIN}/${route}`, { signal: AbortSignal.timeout(1000) }).catch(() => {})
}

/** ZCode 钩子 → Buddy 事件映射（一个钩子可映射为零或多条；未收录钩子返回空） */
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
  const input = JSON.parse(await readStdin())
  await Promise.all(mapEvents(input).map(sendEvent))
} catch {
  // 旁路增强：任何失败静默退出（exit 0），不影响 zcode 会话
}
