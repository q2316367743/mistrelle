import type { ToolFunction, ToolPolicyVerdict } from '@/domain'
import { useSettingSecureStore } from '@/store/setting/SettingSecureStore'
import { isPathBlacklisted } from '@/utils/sandbox'
import { browserActionsPolicy } from './policies/browserActionsPolicy'
import { httpDownloadPolicy } from './policies/httpDownloadPolicy'
import type { ToolPolicy, ToolPolicyContext } from './toolPolicyTypes'

export type { ToolPolicyContext, ToolPolicy } from './toolPolicyTypes'

// ─── 路径工具 ──────────────────────────────────────────────

function isPathUnder(target: string, parent: string): boolean {
  if (!target || !parent) return false
  const t = window.preload.path.normalizePath(target).replace(/\/$/, '')
  const p = window.preload.path.normalizePath(parent).replace(/\/$/, '')
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

// ─── 策略注册表 ──────────────────────────────────────────────

const toolPolicies = new Map<string, ToolPolicy>()

/** 注册工具专属安全策略 */
export function registerToolPolicy(policy: ToolPolicy): void {
  toolPolicies.set(policy.name, policy)
}

// ─── 默认策略 ──────────────────────────────────────────────

/**
 * 通用默认策略（默认模式 mode=0 的基础裁决）：
 * - 可信区域内的路径操作 → allow
 * - 命令白名单 → allow
 * - 其余按 risk 等级映射：dangerous → deny，sensitive → ask
 *
 * 注意：黑名单（fileBlackList / commandAskList）的拦截不再在此处理，
 * 统一交由 resolveToolPolicy 末尾的 hitSecurityBlacklist 覆盖层裁决（命中即 ask），
 * 以保证「三种模式都无法跳过安全中心设置」。
 */
function defaultToolPolicy(
  tool: ToolFunction,
  args: Record<string, unknown>,
  ctx: ToolPolicyContext
): ToolPolicyVerdict {
  const store = useSettingSecureStore()
  const { sandbox } = store.state

  if (!sandbox.enabled) {
    // 沙箱未启用时，非 safe 工具默认需要审批
    return 'ask'
  }

  // ── 路径类工具 ──
  const path = args.path
  if (typeof path === 'string' && path) {
    if (isInTrustedZone(path, ctx)) return 'allow'
    if (sandbox.fileWhiteList.length && isPathUnderAny(path, sandbox.fileWhiteList)) {
      return 'allow'
    }
    // dangerous 在可信区域外强制审批，不可降级
    return 'ask'
  }

  // ── 命令类工具 ──
  const cmdName = extractCommandName(args)
  if (cmdName && sandbox.commandWhiteList.length && matchCommand(cmdName, sandbox.commandWhiteList)) {
    return 'allow'
  }

  // ── 兜底：按风险等级映射 ──
  return tool.risk === 'dangerous' ? 'deny' : 'ask'
}

// ─── 策略解析 ──────────────────────────────────────────────

/**
 * 只读 shell 命令集合：子 Agent（isSubAgent，只读 · 无交互桥）下自动放行，无需用户审批。
 * 只包含纯读取类命令（cli_run 直接执行二进制、无 shell 重定向，参数无法写入文件）；
 * sed（-i 可写）、git（commit/push/checkout 等可写）、tee/touch/mkdir/rm 等写入类不在此列。
 */
const READONLY_SHELL_COMMANDS = new Set([
  'grep', 'rg', 'find', 'cat', 'head', 'tail', 'wc', 'ls', 'less', 'more',
  'sort', 'uniq', 'cut', 'diff', 'cmp', 'file', 'pwd', 'which', 'stat',
  'du', 'df', 'strings', 'xxd', 'hexdump', 'od', 'tr', 'awk', 'echo',
  'basename', 'dirname', 'readlink'
])

/** 判断本次 shell 工具调用是否为只读命令 */
function isReadonlyShellCommand(args: Record<string, unknown>): boolean {
  const cmdName = extractCommandName(args)
  return !!cmdName && READONLY_SHELL_COMMANDS.has(cmdName)
}

/**
 * 根据聊天模式、工具风险等级、运行时参数和安全设置，裁决本次工具调用的执行权限。
 *
 * 模式语义：
 * - 0 默认模式：走正常工具权限（safe 放行、sensitive 需确认、dangerous 拦截、工具专属策略优先）
 * - 1 计划模式：无写入 / 修改权限，执行类（shell）工具需审批，其余（写 / 改）一律禁止
 * - 2 完全访问模式：默认直接放行一切
 *
 * 安全中心黑名单覆盖（与模式无关，最后生效）：一旦命中黑名单（写入指定目录、
 * shell 含指定目录字符串、shell 命中指定命令），无论当前模式如何均需审批（ask）。
 * 覆盖层只将 allow 升级为 ask，不降级已有的 deny / ask。
 */
export function resolveToolPolicy(
  tool: ToolFunction,
  args: Record<string, unknown>,
  ctx: ToolPolicyContext
): ToolPolicyVerdict {
  // safe（只读 / 无副作用）在所有模式下均直接放行；仍受末尾黑名单覆盖层约束
  if (tool.risk === 'safe') {
    return applyBlacklistOverride('allow', args)
  }

  // 子 Agent（只读 · 无交互桥）：只读 shell 命令自动放行，其余维持默认裁决——
  // 需审批的操作会被禁用交互桥自动拒绝（返回"用户拒绝了"），写入类被拦截，保证只读约束
  if (ctx.isSubAgent && isShellExecTool(tool) && isReadonlyShellCommand(args)) {
    return applyBlacklistOverride('allow', args)
  }

  // 模式基础裁决
  let base: ToolPolicyVerdict
  switch (ctx.mode) {
    case 1: // 计划模式：无写入 / 修改权限，shell 需审批
      base = planModePolicy(tool)
      break
    case 2: // 完全访问模式：默认全部放行
      base = 'allow'
      break
    default: // 0 默认模式：正常工具权限流
      {
        const policy = toolPolicies.get(tool.name)
        if (policy) {
          const verdict = policy.resolve(tool, args, ctx)
          if (verdict !== null) return applyBlacklistOverride(verdict, args)
        }
        base = defaultToolPolicy(tool, args, ctx)
      }
      break
  }

  // 安全中心黑名单覆盖（与模式无关）：命中则需审批
  return applyBlacklistOverride(base, args)
}

/**
 * 黑名单覆盖层：将基础裁决中为 allow 的结果，在命中安全中心黑名单时升级为 ask。
 * 不改动已有的 deny / ask（即黑名单不会让本就更严格的裁决变宽松）。
 */
function applyBlacklistOverride(
  verdict: ToolPolicyVerdict,
  args: Record<string, unknown>
): ToolPolicyVerdict {
  if (verdict !== 'deny' && hitSecurityBlacklist(args)) return 'ask'
  return verdict
}

// ─── 辅助 ──────────────────────────────────────────────

function isPathUnderAny(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => isPathUnder(path, pattern))
}

function matchCommand(name: string, list: string[]): boolean {
  return list.some((item) => item.toLowerCase() === name)
}

// ─── 执行类（shell）工具识别 ──────────────────────────────

/**
 * 执行类（shell）工具名集合：底层都通过 cliRun 运行外部程序 / 脚本，
 * 计划模式下需经用户审批，不可静默放行。
 * 说明：js_run 为受限 JS 沙箱（safe）、git_exec 为只读 git 操作（safe），均不在此列。
 */
export const SHELL_EXEC_TOOL_NAMES = new Set<string>(['cli_run', 'python_run', 'node_run'])

/** 判断某工具是否为执行类（shell）工具 */
export function isShellExecTool(tool: ToolFunction): boolean {
  return SHELL_EXEC_TOOL_NAMES.has(tool.name)
}

// ─── 安全中心黑名单覆盖（与聊天模式无关） ──────────────────

/** 将路径归一化（展开 ~）用于黑名单子串匹配 */
function argContainsBlacklistPath(value: string, blackList: string[]): boolean {
  const normalizedValue = window.preload.path.normalizePath(value)
  return blackList.some((pattern) => normalizedValue.includes(window.preload.path.normalizePath(pattern)))
}

/**
 * 是否命中安全中心黑名单。命中则无论当前聊天模式如何，本次调用都需要用户审批。
 * 覆盖三类场景：
 * 1. 文件路径类工具：args.path 命中 fileBlackList（写入指定目录）
 * 2. 任意参数字符串包含黑名单目录（shell 命令 / 代码 / 文件路径 / cwd 中含有指定目录字符串）
 * 3. shell 命令名命中 commandAskList（shell 命中了指定命令）
 */
function hitSecurityBlacklist(args: Record<string, unknown>): boolean {
  const store = useSettingSecureStore()
  const sandbox = store.state.sandbox
  if (!sandbox.enabled) return false
  const hasFileList = sandbox.fileBlackList.length > 0
  const hasCmdList = sandbox.commandAskList.length > 0
  if (!hasFileList && !hasCmdList) return false

  if (hasFileList) {
    // 1. 显式路径参数命中
    const path = args.path
    if (typeof path === 'string' && path && isPathBlacklisted(path, sandbox.fileBlackList)) {
      return true
    }
    // 2. 任意字符串参数包含黑名单目录（覆盖 cli_run 的 command、python_run/node_run 的 code/file/cwd）
    for (const value of Object.values(args)) {
      if (typeof value === 'string' && argContainsBlacklistPath(value, sandbox.fileBlackList)) {
        return true
      }
    }
  }

  // 3. shell 命令名命中询问名单
  const cmdName = extractCommandName(args)
  if (cmdName && hasCmdList && matchCommand(cmdName, sandbox.commandAskList)) {
    return true
  }
  return false
}

// ─── 计划模式策略（mode=1） ────────────────────────────────

/**
 * 计划模式（mode=1）策略：
 * - 只读 / 分析类工具已在 resolveToolPolicy 前置放行（safe）
 * - 执行类（shell）工具需用户审批
 * - 其余（写入 / 修改类）一律禁止
 */
function planModePolicy(tool: ToolFunction): ToolPolicyVerdict {
  if (isShellExecTool(tool)) return 'ask'
  return 'deny'
}

// 注册工具专属策略
registerToolPolicy(browserActionsPolicy)
registerToolPolicy(httpDownloadPolicy)
