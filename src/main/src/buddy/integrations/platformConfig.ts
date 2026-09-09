/**
 * 应用集成配置（main 进程）：按软件分发「接入配置检查 / 安装」。
 * 接入的含义由各软件 adapter 决定：
 * - opencode = 把内置插件模板复制到其全局插件目录（官方约定启动自动加载，无需注册 opencode.json）
 * - zcode = 钩子脚本复制到 mistrelle 自有目录 + hooks 配置合并写入 ~/.zcode/cli/config.json
 *   （只动 hooks 键、写前备份 .bak、按安装路径标记幂等替换本方条目；新会话生效）
 * 卸载按各软件语义还原：opencode 删插件文件；zcode 摘本方条目（保留用户自有条目）+ 删脚本目录。
 * 新增软件 = SOFTWARE_NAMES 加成员 + resources/plugins/<软件>/ 放模板 + 此处补一个 adapter。
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import type { PlatformInstallResult, PlatformStatus } from '@common/types/integrations'
import { isSoftwareName, type SoftwareName } from '@common/types/trafficLight'

/** 接入 adapter：check 判定三态，install 覆盖安装，uninstall 还原清理（均不抛错，结果对象返回） */
interface PlatformAdapter {
  check(): PlatformStatus
  install(): PlatformInstallResult
  uninstall(): PlatformInstallResult
}

/** 内置插件模板路径（resources 整体 asarUnpack，dev/打包均以 __dirname 相对定位） */
const OPENCODE_PLUGIN_TEMPLATE = join(
  __dirname,
  '../../resources/plugins/opencode/mistrelle-integration.js'
)

/** opencode 全局插件目录（~/.config/opencode/plugins/，跨平台一致） */
function opencodePluginFile(): string {
  return join(app.getPath('home'), '.config', 'opencode', 'plugins', 'mistrelle-integration.js')
}

/** 改名前的旧插件文件名（install 时顺带清理，防 opencode 同时加载两份插件造成事件双投递） */
const OPENCODE_LEGACY_PLUGIN_NAME = 'mistrelle-traffic-light.js'

function checkOpencode(): PlatformStatus {
  const path = opencodePluginFile()
  try {
    if (!existsSync(path)) return { status: 'missing', path }
    const outdated = readFileSync(path, 'utf-8') !== readFileSync(OPENCODE_PLUGIN_TEMPLATE, 'utf-8')
    return { status: outdated ? 'outdated' : 'ready', path }
  } catch {
    // 模板不可读（打包缺失等）：视为未安装，安装时会给出具体报错
    return { status: 'missing', path }
  }
}

function installOpencode(): PlatformInstallResult {
  const path = opencodePluginFile()
  try {
    mkdirSync(dirname(path), { recursive: true })
    copyFileSync(OPENCODE_PLUGIN_TEMPLATE, path)
    try {
      rmSync(join(dirname(path), OPENCODE_LEGACY_PLUGIN_NAME), { force: true })
    } catch {
      // 旧文件清理失败不影响安装结果（残留只可能导致事件重复投递，下次安装再清理）
    }
    return { ok: true, path }
  } catch (error) {
    return { ok: false, msg: '插件安装失败：' + (error as Error).message, path }
  }
}

/** ---------- ZCode（hooks 配置合并路线） ---------- */

/** ZCode 钩子脚本模板目录（resources 整体 asarUnpack，dev/打包均以 __dirname 相对定位） */
const ZCODE_HOOK_TEMPLATE_DIR = join(__dirname, '../../resources/plugins/zcode')

/** ZCode 钩子脚本名：forward = 事件转发（async 防火忘），permission = 权限审批双向流（同步阻塞） */
const ZCODE_HOOK_TEMPLATES = ['forward.mjs', 'permission.mjs']

/** 钩子脚本安装目录（mistrelle 自有目录；config.json 以绝对路径引用，不依赖 zcode 插件体系） */
function zcodeHookDir(): string {
  return join(app.getPath('home'), '.mistrelle', 'integrations', 'zcode')
}

/** ZCode 用户级配置文件（hooks 配置所在；安装只增改 hooks 键，其余键一律不动） */
function zcodeConfigFile(): string {
  return join(app.getPath('home'), '.zcode', 'cli', 'config.json')
}

/** 本方条目标记：条目内容含安装目录路径即认定是 mistrelle 写入（重装幂等替换旧条目） */
const ZCODE_HOOK_MARKER = '.mistrelle/integrations/zcode/'

/** 需要登记钩子的事件全集（forward.mjs 内部按 hook_event_name 映射 Buddy 事件） */
const ZCODE_HOOK_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'Stop',
  'PermissionRequest'
] as const

/**
 * 单个事件的钩子条目（官方 schema：events 数组元素是 { matcher?, hooks: [...] } 包装，
 * 裸钩子对象不会被注册——曾因此新会话零事件）。钩子一律内联执行（官方 async 字段
 * 无运行时效果）：转发 = command 跑一次本地 fetch 即退（timeoutMs 兜底防挂），
 * 权限 = process 同步阻塞等决定。
 */
function zcodeHookEntry(event: string, hookDir: string): Record<string, unknown> {
  if (event === 'PermissionRequest') {
    return {
      hooks: [
        {
          type: 'process',
          command: 'node',
          args: [join(hookDir, 'permission.mjs')],
          timeoutMs: 330000
        }
      ]
    }
  }
  return {
    hooks: [
      { type: 'command', command: `node "${join(hookDir, 'forward.mjs')}"`, timeoutMs: 15000 }
    ]
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** config.json 中本方条目是否齐全且启用（解析失败/条目缺失/不符/enabled 未开都视为不齐全） */
function zcodeEntriesReady(hookDir: string): boolean {
  let config: unknown
  try {
    config = JSON.parse(readFileSync(zcodeConfigFile(), 'utf-8'))
  } catch {
    return false
  }
  if (!isRecord(config)) return false
  const hooks = config['hooks']
  if (!isRecord(hooks) || hooks['enabled'] !== true) return false
  const events = hooks['events']
  if (!isRecord(events)) return false
  return ZCODE_HOOK_EVENTS.every((event) => {
    const list = events[event]
    if (!Array.isArray(list)) return false
    const expected = JSON.stringify(zcodeHookEntry(event, hookDir))
    return list.some((entry) => isRecord(entry) && JSON.stringify(entry) === expected)
  })
}

function checkZcode(): PlatformStatus {
  const path = zcodeHookDir()
  try {
    for (const name of ZCODE_HOOK_TEMPLATES) {
      const target = join(path, name)
      if (!existsSync(target)) return { status: 'missing', path }
      const outdated =
        readFileSync(target, 'utf-8') !== readFileSync(join(ZCODE_HOOK_TEMPLATE_DIR, name), 'utf-8')
      if (outdated) return { status: 'outdated', path }
    }
    return { status: zcodeEntriesReady(path) ? 'ready' : 'missing', path }
  } catch {
    // 模板不可读（打包缺失等）：视为未安装，安装时会给出具体报错
    return { status: 'missing', path }
  }
}

function installZcode(): PlatformInstallResult {
  const hookDir = zcodeHookDir()
  const configFile = zcodeConfigFile()
  try {
    // 1) 落钩子脚本
    mkdirSync(hookDir, { recursive: true })
    for (const name of ZCODE_HOOK_TEMPLATES) {
      copyFileSync(join(ZCODE_HOOK_TEMPLATE_DIR, name), join(hookDir, name))
    }
    // 2) 合并 config.json：先读先校验（解析失败即中止绝不覆写），写前备份 .bak
    let config: Record<string, unknown> = {}
    if (existsSync(configFile)) {
      const parsed: unknown = JSON.parse(readFileSync(configFile, 'utf-8'))
      if (!isRecord(parsed)) {
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
        (entry) => !(isRecord(entry) && JSON.stringify(entry).includes(ZCODE_HOOK_MARKER))
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

/** 卸载 opencode：删除插件文件与改名前旧名残留（幂等，不存在也算成功） */
function uninstallOpencode(): PlatformInstallResult {
  const path = opencodePluginFile()
  try {
    rmSync(path, { force: true })
    try {
      rmSync(join(dirname(path), OPENCODE_LEGACY_PLUGIN_NAME), { force: true })
    } catch {
      // 旧文件清理失败不影响卸载结果，下次安装/卸载再清理
    }
    return { ok: true, path }
  } catch (error) {
    return { ok: false, msg: '插件卸载失败：' + (error as Error).message, path }
  }
}

/** 卸载 zcode：摘除本方钩子条目还原 config.json + 删除脚本目录 */
function uninstallZcode(): PlatformInstallResult {
  const hookDir = zcodeHookDir()
  const configFile = zcodeConfigFile()
  try {
    // 1) 先解析 config（失败即中止，绝不碰用户配置；本方条目未摘除时可再次卸载）
    let config: Record<string, unknown> | null = null
    if (existsSync(configFile)) {
      const parsed: unknown = JSON.parse(readFileSync(configFile, 'utf-8'))
      if (!isRecord(parsed)) {
        return { ok: false, msg: 'ZCode 配置文件不是 JSON 对象，已中止卸载', path: hookDir }
      }
      config = parsed
    }
    // 2) 按标记摘除本方条目：摘空的事件键删除；events 全空时仅在本方遗留键也清空后整体还原
    if (config) {
      const hooks = config['hooks']
      if (isRecord(hooks) && isRecord(hooks['events'])) {
        const events = hooks['events']
        for (const [event, list] of Object.entries(events)) {
          if (!Array.isArray(list)) continue
          const kept = list.filter(
            (entry) => !(isRecord(entry) && JSON.stringify(entry).includes(ZCODE_HOOK_MARKER))
          )
          if (kept.length === 0) delete events[event]
          else events[event] = kept
        }
        if (Object.keys(events).length === 0) {
          delete hooks['events']
          if (Object.keys(hooks).length === 0) delete config['hooks']
        }
      }
    }
    // 3) 删脚本目录 + 回写配置（写前备份，语义与安装对称）
    rmSync(hookDir, { recursive: true, force: true })
    if (config) {
      copyFileSync(configFile, `${configFile}.bak`)
      mkdirSync(dirname(configFile), { recursive: true })
      writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n', 'utf-8')
    }
    return { ok: true, path: hookDir }
  } catch (error) {
    return { ok: false, msg: 'ZCode 钩子卸载失败：' + (error as Error).message, path: hookDir }
  }
}

/** adapter 注册表：键与 SOFTWARE_NAMES 全集对齐 */
const ADAPTERS: Record<SoftwareName, PlatformAdapter> = {
  opencode: { check: checkOpencode, install: installOpencode, uninstall: uninstallOpencode },
  zcode: { check: checkZcode, install: installZcode, uninstall: uninstallZcode }
}

/** 检查指定软件的接入配置状态（未知软件按未安装处理） */
export function checkPlatform(software: string): PlatformStatus {
  if (!isSoftwareName(software)) return { status: 'missing', path: '' }
  return ADAPTERS[software].check()
}

/** 安装/更新指定软件的接入配置（未知软件返回失败，不抛错） */
export function installPlatform(software: string): PlatformInstallResult {
  if (!isSoftwareName(software)) return { ok: false, msg: '未知软件，无法安装接入配置', path: '' }
  return ADAPTERS[software].install()
}

/** 卸载指定软件的接入配置（未知软件返回失败，不抛错） */
export function uninstallPlatform(software: string): PlatformInstallResult {
  if (!isSoftwareName(software)) return { ok: false, msg: '未知软件，无法卸载接入配置', path: '' }
  return ADAPTERS[software].uninstall()
}
