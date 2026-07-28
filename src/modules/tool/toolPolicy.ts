import type { ToolFunction, ToolPolicyVerdict } from '@/domain'
import { useSettingSecureStore } from '@/store/setting/SettingSecureStore'
import { isPathBlacklisted } from '@/utils/sandbox'

/** 策略解析所需的运行时上下文 */
export interface ToolPolicyContext {
  sandboxDir: string
  workspace: string
}

// ─── 路径工具 ──────────────────────────────────────────────

function normalizePath(path: string): string {
  return path.replace(/^~/, window.preload.inject.os.getPath('home'))
}

function isPathUnder(target: string, parent: string): boolean {
  if (!target || !parent) return false
  const t = normalizePath(target).replace(/\/$/, '')
  const p = normalizePath(parent).replace(/\/$/, '')
  return t === p || t.startsWith(p + '/')
}

/** 判断路径是否处于可信区域（沙盒或用户工作空间） */
function isInTrustedZone(path: string, ctx: ToolPolicyContext): boolean {
  if (ctx.sandboxDir && isPathUnder(path, ctx.sandboxDir)) return true
  if (ctx.workspace && isPathUnder(path, ctx.workspace)) return true
  return false
}

// ─── 命令解析 ──────────────────────────────────────────────

/**
 * 从工具参数中提取主命令名（basename）。
 * TODO: 当前仅做 basename 关键字匹配，后续可扩展为 shell 语句深度解析
 *       （如解析 bash -c "..." 内嵌命令、管道链、子 shell 等）
 */
function extractCommandName(args: Record<string, unknown>): string {
  const command = args.command
  if (typeof command === 'string' && command) {
    return command.split('/').pop()?.toLowerCase() ?? ''
  }
  return ''
}

// ─── 策略解析 ──────────────────────────────────────────────

/**
 * 根据工具风险等级、运行时参数和安全设置，裁决本次工具调用的执行权限。
 *
 * 裁决优先级：deny > allow > ask
 * - 黑名单路径 / 拒绝域名 → deny（不可覆盖）
 * - 可信区域内的路径操作 → allow
 * - 命令白名单 → allow
 * - 其余按 risk 等级映射默认行为
 */
export function resolveToolPolicy(
  tool: ToolFunction,
  args: Record<string, unknown>,
  ctx: ToolPolicyContext
): ToolPolicyVerdict {
  const risk = tool.risk ?? 'sensitive'
  if (risk === 'safe') return 'allow'

  const store = useSettingSecureStore()
  const { sandbox } = store.state

  if (!sandbox.enabled) {
    // 沙箱未启用时按风险等级直接映射
    return risk === 'dangerous' ? 'ask' : 'ask'
  }

  // ── 路径类工具：file_write / file_delete / file_write_xlsx 等含 args.path 的工具 ──
  const path = args.path
  if (typeof path === 'string' && path) {
    // 黑名单强制拦截（写入/删除类操作）
    if (sandbox.fileBlackList.length && isPathBlacklisted(path, sandbox.fileBlackList)) {
      return 'deny'
    }
    // 可信区域内自动放行（含沙盒内删除）
    if (isInTrustedZone(path, ctx)) return 'allow'
    // 白名单放行
    if (sandbox.fileWhiteList.length && isPathUnderAny(path, sandbox.fileWhiteList)) {
      return 'allow'
    }
    // dangerous 在可信区域外强制审批，不可降级
    return 'ask'
  }

  // ── 命令类工具：cli_run / python_run / node_run ──
  const cmdName = extractCommandName(args)
  if (cmdName) {
    if (sandbox.commandWhiteList.length && matchCommand(cmdName, sandbox.commandWhiteList)) {
      return 'allow'
    }
    if (sandbox.commandAskList.length && matchCommand(cmdName, sandbox.commandAskList)) {
      return 'ask'
    }
  }

  // ── 默认：按风险等级映射 ──
  return risk === 'dangerous' ? 'deny' : 'ask'
}

// ─── 辅助 ──────────────────────────────────────────────

function isPathUnderAny(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => isPathUnder(path, pattern))
}

function matchCommand(name: string, list: string[]): boolean {
  return list.some((item) => item.toLowerCase() === name)
}
