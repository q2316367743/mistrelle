/**
 * hooks 系平台（zcode / claude / codex）共用接入基建与各自 adapter 实现。
 * 三家 CLI 的 hooks 机制同源（仿 Claude Code）：配置是「事件名 → [{hooks:[...]}]」
 * 条目表，钩子脚本以 stdin JSON 收事件，PermissionRequest 以 stdout JSON 代答
 * （decision.behavior 契约三家一致）。差异仅在：
 * - 配置文件与事件表挂载路径：zcode = ~/.zcode/cli/config.json 的 hooks.events
 *   （另强制 hooks.enabled = true）；claude = ~/.claude/settings.json 的 hooks 键；
 *   codex = ~/.codex/hooks.json 专用文件（features.hooks 默认启用，无需动 config.toml）
 * - 条目 schema：timeout 单位（zcode 毫秒 / claude·codex 秒）、形式（claude 支持
 *   exec form 的 args、codex 仅 shell form）、codex 转发钩子可 async 后台零阻塞；
 *   codex 非托管钩子首次须用户在 CLI 内 /hooks 审查信任后才执行（平台限制，见
 *   渲染层 INTEGRATION_REGISTRY 的 effectHint）
 * 共用脚本模板 resources/plugins/hooks/（forward = 事件转发、permission = 权限双向
 * 流，平台名由 argv 传入），安装到 ~/.mistrelle/integrations/<平台>/，配置条目以
 * 该路径为 marker 幂等替换本方条目、保留用户自有条目，写前备份 .bak。
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import type { PlatformInstallResult, PlatformStatus } from '@common/types/integrations'
import type { SoftwareName } from '@common/types/trafficLight'

/** 共享钩子脚本模板目录（resources 整体 asarUnpack，dev/打包均以 __dirname 相对定位） */
const HOOK_TEMPLATE_DIR = join(__dirname, '../../resources/plugins/hooks')

/** 共享钩子脚本名：forward = 事件转发（fetch 即退），permission = 权限审批双向流（同步阻塞） */
const HOOK_SCRIPTS = ['forward.mjs', 'permission.mjs']

/** 脚本安装目录（mistrelle 自有目录按平台分目录；配置条目以路径为 marker 识别本方条目） */
function hookDirOf(platform: SoftwareName): string {
  return join(app.getPath('home'), '.mistrelle', 'integrations', platform)
}

/** 配置条目标记：条目内容含本平台安装目录路径即认定是 mistrelle 写入（重装幂等替换） */
function markerOf(platform: SoftwareName): string {
  return `.mistrelle/integrations/${platform}/`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readJsonConfig(file: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf-8'))
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** 脚本三态：缺任一 = missing；内容与模板不一致 = outdated；齐全返回 null（继续查配置） */
function checkHookScripts(platform: SoftwareName): PlatformStatus | null {
  const path = hookDirOf(platform)
  try {
    for (const name of HOOK_SCRIPTS) {
      const target = join(path, name)
      if (!existsSync(target)) return { status: 'missing', path }
      if (readFileSync(target, 'utf-8') !== readFileSync(join(HOOK_TEMPLATE_DIR, name), 'utf-8')) {
        return { status: 'outdated', path }
      }
    }
    return null
  } catch {
    // 模板不可读（打包缺失等）：视为未安装，安装时会给出具体报错
    return { status: 'missing', path }
  }
}

/** 落钩子脚本到平台目录，返回目录路径 */
function installHookScripts(platform: SoftwareName): string {
  const dir = hookDirOf(platform)
  mkdirSync(dir, { recursive: true })
  for (const name of HOOK_SCRIPTS) {
    copyFileSync(join(HOOK_TEMPLATE_DIR, name), join(dir, name))
  }
  return dir
}

/** 摘除事件表中含 marker 的本方条目，摘空的事件键删除；返回是否有变化 */
function stripMarkedEntries(events: Record<string, unknown>, marker: string): boolean {
  let changed = false
  for (const [event, list] of Object.entries(events)) {
    if (!Array.isArray(list)) continue
    const kept = list.filter(
      (entry) => !(isRecord(entry) && JSON.stringify(entry).includes(marker))
    )
    if (kept.length !== list.length) {
      changed = true
      if (kept.length === 0) delete events[event]
      else events[event] = kept
    }
  }
  return changed
}

/** 事件表中本方条目是否齐全（每个事件的期望条目存在且 JSON 相等） */
function entriesReady(
  events: unknown,
  allEvents: readonly string[],
  buildEntry: (event: string, hookDir: string) => Record<string, unknown>,
  hookDir: string
): boolean {
  if (!isRecord(events)) return false
  return allEvents.every((event) => {
    const list = events[event]
    if (!Array.isArray(list)) return false
    const expected = JSON.stringify(buildEntry(event, hookDir))
    return list.some((entry) => isRecord(entry) && JSON.stringify(entry) === expected)
  })
}

/** ---------- ZCode（config.json hooks.events + enabled 开关，timeout 毫秒） ---------- */

/** hooks 系钩子事件全集：zcode 与 claude 同源同名（Claude Code 即原型，含 PostToolUseFailure） */
const HOOKS_EVENTS_FULL = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'Stop',
  'PermissionRequest'
] as const

const ZCODE_HOOK_EVENTS = HOOKS_EVENTS_FULL

function zcodeConfigFile(): string {
  return join(app.getPath('home'), '.zcode', 'cli', 'config.json')
}

/**
 * 单个事件的钩子条目（官方 schema：events 数组元素是 { matcher?, hooks: [...] } 包装，
 * 裸钩子对象不会被注册——曾因此新会话零事件）。钩子一律内联执行（官方 async 字段
 * 无运行时效果）：转发 = command 跑一次本地 fetch 即退（timeoutMs 兜底防挂），
 * 权限 = process 同步阻塞等决定。脚本平台名以 argv 传入（见 hooks/forward.mjs）。
 */
function zcodeHookEntry(event: string, hookDir: string): Record<string, unknown> {
  if (event === 'PermissionRequest') {
    return {
      hooks: [
        {
          type: 'process',
          command: 'node',
          args: [join(hookDir, 'permission.mjs'), 'zcode'],
          timeoutMs: 330000
        }
      ]
    }
  }
  return {
    hooks: [
      { type: 'command', command: `node "${join(hookDir, 'forward.mjs')}" zcode`, timeoutMs: 15000 }
    ]
  }
}

export function checkZcode(): PlatformStatus {
  const path = hookDirOf('zcode')
  const scripts = checkHookScripts('zcode')
  if (scripts) return scripts
  const config = readJsonConfig(zcodeConfigFile())
  const hooks = config?.['hooks']
  if (!isRecord(hooks) || hooks['enabled'] !== true) return { status: 'missing', path }
  return {
    status: entriesReady(hooks['events'], ZCODE_HOOK_EVENTS, zcodeHookEntry, path) ? 'ready' : 'missing',
    path
  }
}

export function installZcode(): PlatformInstallResult {
  const hookDir = hookDirOf('zcode')
  const configFile = zcodeConfigFile()
  try {
    installHookScripts('zcode')
    // 合并 config.json：先读先校验（解析失败即中止绝不覆写），写前备份 .bak
    let config: Record<string, unknown> = {}
    if (existsSync(configFile)) {
      const parsed = readJsonConfig(configFile)
      if (!parsed) {
        return { ok: false, msg: 'ZCode 配置文件不是 JSON 对象，已中止写入', path: hookDir }
      }
      config = parsed
      copyFileSync(configFile, `${configFile}.bak`)
    }
    const hooks = isRecord(config['hooks']) ? { ...config['hooks'] } : {}
    const events = isRecord(hooks['events']) ? { ...hooks['events'] } : {}
    for (const event of ZCODE_HOOK_EVENTS) {
      const list = Array.isArray(events[event]) ? (events[event] as unknown[]) : []
      // 摘除本方旧条目（幂等重装 + 安装路径变更清理），用户自有条目原样保留
      const kept = list.filter(
        (entry) => !(isRecord(entry) && JSON.stringify(entry).includes(markerOf('zcode')))
      )
      events[event] = [...kept, zcodeHookEntry(event, hookDir)]
    }
    hooks['enabled'] = true
    hooks['events'] = events
    config['hooks'] = hooks
    mkdirSync(dirname(configFile), { recursive: true })
    writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n', 'utf-8')
    return { ok: true, path: hookDir }
  } catch (error) {
    return { ok: false, msg: 'ZCode 钩子安装失败：' + (error as Error).message, path: hookDir }
  }
}

export function uninstallZcode(): PlatformInstallResult {
  return uninstallHooks('zcode', zcodeConfigFile(), {
    // 事件表在 hooks.events 下（比 claude/codex 深一层）
    table: (config) => {
      const hooks = config['hooks']
      return isRecord(hooks) && isRecord(hooks['events'])
        ? (hooks['events'] as Record<string, unknown>)
        : null
    },
    // config.json 是宿主软件共享配置：摘空后逐级还原本方容器键（events/hooks），绝不删文件
    cleanup: (config) => {
      const hooks = config['hooks']
      if (isRecord(hooks) && isRecord(hooks['events'])) {
        const events = hooks['events'] as Record<string, unknown>
        if (Object.keys(events).length === 0) {
          delete hooks['events']
          if (Object.keys(hooks).length === 0) delete config['hooks']
        }
      }
    }
  })
}

/** ---------- Claude Code（settings.json hooks 键，timeout 秒，exec form） ---------- */

/** 与 ZCode 钩子名同源（Claude Code 即原型），全集一致（含 PostToolUseFailure） */
const CLAUDE_HOOK_EVENTS = HOOKS_EVENTS_FULL

function claudeConfigFile(): string {
  return join(app.getPath('home'), '.claude', 'settings.json')
}

/**
 * 单个事件的钩子条目：统一 exec form（command + args 数组，免 shell 引号转义），
 * timeout 单位秒（官方默认 UserPromptSubmit 30s、其余 600s）。PermissionRequest
 * 是阻塞钩子，须留足 mistrelle 端 4.5min 审批窗口（330s 同 zcode 语义）。
 */
function claudeHookEntry(event: string, hookDir: string): Record<string, unknown> {
  const script = event === 'PermissionRequest' ? 'permission.mjs' : 'forward.mjs'
  return {
    hooks: [
      {
        type: 'command',
        command: 'node',
        args: [join(hookDir, script), 'claude'],
        timeout: event === 'PermissionRequest' ? 330 : 15
      }
    ]
  }
}

export function checkClaude(): PlatformStatus {
  const path = hookDirOf('claude')
  const scripts = checkHookScripts('claude')
  if (scripts) return scripts
  const config = readJsonConfig(claudeConfigFile())
  return {
    status: entriesReady(config?.['hooks'], CLAUDE_HOOK_EVENTS, claudeHookEntry, path) ? 'ready' : 'missing',
    path
  }
}

export function installClaude(): PlatformInstallResult {
  const hookDir = hookDirOf('claude')
  const configFile = claudeConfigFile()
  try {
    installHookScripts('claude')
    let config: Record<string, unknown> = {}
    if (existsSync(configFile)) {
      const parsed = readJsonConfig(configFile)
      if (!parsed) {
        return { ok: false, msg: 'Claude Code 配置文件不是 JSON 对象，已中止写入', path: hookDir }
      }
      config = parsed
      copyFileSync(configFile, `${configFile}.bak`)
    }
    const hooks = isRecord(config['hooks']) ? { ...config['hooks'] } : {}
    for (const event of CLAUDE_HOOK_EVENTS) {
      const list = Array.isArray(hooks[event]) ? (hooks[event] as unknown[]) : []
      const kept = list.filter(
        (entry) => !(isRecord(entry) && JSON.stringify(entry).includes(markerOf('claude')))
      )
      hooks[event] = [...kept, claudeHookEntry(event, hookDir)]
    }
    config['hooks'] = hooks
    mkdirSync(dirname(configFile), { recursive: true })
    writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n', 'utf-8')
    return { ok: true, path: hookDir }
  } catch (error) {
    return { ok: false, msg: 'Claude Code 钩子安装失败：' + (error as Error).message, path: hookDir }
  }
}

export function uninstallClaude(): PlatformInstallResult {
  return uninstallHooks('claude', claudeConfigFile(), {
    // 事件表直接在 hooks 键下
    table: (config) => (isRecord(config['hooks']) ? (config['hooks'] as Record<string, unknown>) : null),
    // settings.json 是宿主软件共享配置：摘空后仅删本方 hooks 键，其余键（model 等）原样保留
    cleanup: (config) => {
      const hooks = config['hooks']
      if (isRecord(hooks) && Object.keys(hooks).length === 0) delete config['hooks']
    }
  })
}

/** ---------- Codex（hooks.json 专用文件，timeout 秒，shell form，转发 async） ---------- */

/** Codex 无 PostToolUseFailure 钩子，其余与 zcode/claude 同名 */
const CODEX_HOOK_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'Stop',
  'PermissionRequest'
] as const

function codexConfigFile(): string {
  return join(app.getPath('home'), '.codex', 'hooks.json')
}

/**
 * 单个事件的钩子条目：Codex handler 仅支持 shell form（无 args 字段）。转发钩子
 * async: true 后台执行零阻塞（本地 fetch 毫秒级即退）；PermissionRequest 必须同步
 * 挂起等决定，timeout 留足审批窗口。注意：非托管钩子首次须用户在 Codex 内 /hooks
 * 审查信任后才执行，未信任会被静默跳过（check 无法感知，靠 effectHint 提示）。
 */
function codexHookEntry(event: string, hookDir: string): Record<string, unknown> {
  if (event === 'PermissionRequest') {
    return {
      hooks: [
        { type: 'command', command: `node "${join(hookDir, 'permission.mjs')}" codex`, timeout: 330 }
      ]
    }
  }
  return {
    hooks: [
      {
        type: 'command',
        command: `node "${join(hookDir, 'forward.mjs')}" codex`,
        async: true,
        timeout: 15
      }
    ]
  }
}

export function checkCodex(): PlatformStatus {
  const path = hookDirOf('codex')
  const scripts = checkHookScripts('codex')
  if (scripts) return scripts
  const config = readJsonConfig(codexConfigFile())
  return {
    status: entriesReady(config?.['hooks'], CODEX_HOOK_EVENTS, codexHookEntry, path) ? 'ready' : 'missing',
    path
  }
}

export function installCodex(): PlatformInstallResult {
  const hookDir = hookDirOf('codex')
  const configFile = codexConfigFile()
  try {
    installHookScripts('codex')
    let config: Record<string, unknown> = {}
    if (existsSync(configFile)) {
      const parsed = readJsonConfig(configFile)
      if (!parsed) {
        return { ok: false, msg: 'Codex hooks 配置文件不是 JSON 对象，已中止写入', path: hookDir }
      }
      config = parsed
      copyFileSync(configFile, `${configFile}.bak`)
    }
    const hooks = isRecord(config['hooks']) ? { ...config['hooks'] } : {}
    for (const event of CODEX_HOOK_EVENTS) {
      const list = Array.isArray(hooks[event]) ? (hooks[event] as unknown[]) : []
      const kept = list.filter(
        (entry) => !(isRecord(entry) && JSON.stringify(entry).includes(markerOf('codex')))
      )
      hooks[event] = [...kept, codexHookEntry(event, hookDir)]
    }
    config['description'] =
      typeof config['description'] === 'string' && config['description']
        ? config['description']
        : 'Mistrelle 应用集成钩子'
    config['hooks'] = hooks
    mkdirSync(dirname(configFile), { recursive: true })
    writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n', 'utf-8')
    return { ok: true, path: hookDir }
  } catch (error) {
    return { ok: false, msg: 'Codex 钩子安装失败：' + (error as Error).message, path: hookDir }
  }
}

export function uninstallCodex(): PlatformInstallResult {
  return uninstallHooks('codex', codexConfigFile(), {
    // 事件表直接在 hooks 键下
    table: (config) => (isRecord(config['hooks']) ? (config['hooks'] as Record<string, unknown>) : null),
    // hooks.json 是 hooks 专用文件：本方条目摘空且文件仅剩本方键（description/hooks）时整文件删除
    cleanup: (config) => {
      const hooks = config['hooks']
      if (!isRecord(hooks) || Object.keys(hooks).length > 0) return 'keep'
      const rest = Object.keys(config).filter((key) => key !== 'hooks' && key !== 'description')
      return rest.length === 0 ? 'remove-file' : 'keep'
    }
  })
}

/** ---------- 三家共用卸载骨架 ---------- */

interface UninstallOptions {
  /** 从 config 定位本平台事件表（zcode 在 hooks.events 下，claude/codex 在 hooks 键下） */
  table(config: Record<string, unknown>): Record<string, unknown> | null
  /** 本方条目摘除后对配置的收尾：返回 'remove-file' 删除整个文件（'keep'/undefined=回写清理后的配置） */
  cleanup(config: Record<string, unknown>): void | 'keep' | 'remove-file'
}

/**
 * hooks 系共用卸载：先解析配置（失败即中止，绝不碰用户配置；本方条目未摘除时可
 * 再次卸载）→ 按标记摘除本方条目 → cleanup 收尾 → 删脚本目录 → 需要时备份回写。
 */
function uninstallHooks(
  platform: SoftwareName,
  configFile: string,
  options: UninstallOptions
): PlatformInstallResult {
  const hookDir = hookDirOf(platform)
  const marker = markerOf(platform)
  try {
    let config: Record<string, unknown> | null = null
    if (existsSync(configFile)) {
      const parsed = readJsonConfig(configFile)
      if (!parsed) {
        return { ok: false, msg: '配置文件不是 JSON 对象，已中止卸载', path: hookDir }
      }
      config = parsed
      const table = options.table(config)
      if (table) stripMarkedEntries(table, marker)
      if (options.cleanup(config) === 'remove-file') {
        copyFileSync(configFile, `${configFile}.bak`)
        rmSync(configFile, { force: true })
      } else {
        copyFileSync(configFile, `${configFile}.bak`)
        mkdirSync(dirname(configFile), { recursive: true })
        writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n', 'utf-8')
      }
    }
    rmSync(hookDir, { recursive: true, force: true })
    return { ok: true, path: hookDir }
  } catch (error) {
    return { ok: false, msg: '钩子卸载失败：' + (error as Error).message, path: hookDir }
  }
}
