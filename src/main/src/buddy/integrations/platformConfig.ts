/**
 * 应用集成配置（main 进程）：按软件分发「接入配置检查 / 安装」。
 * 接入的含义由各软件 adapter 决定：
 * - opencode = 把内置插件模板复制到其全局插件目录（官方约定启动自动加载，无需注册 opencode.json）
 * - zcode / claude / codex = hooks 配置合并写入各自 CLI 的配置（条目 schema 与挂载路径
 *   略异，共用基建见同目录 hooksAdapter.ts：脚本装 ~/.mistrelle/integrations/<平台>/、
 *   按 marker 幂等替换本方条目、保留用户自有条目、写前备份 .bak）
 * 卸载按各软件语义还原：opencode 删插件文件；hooks 系摘本方条目 + 删脚本目录。
 * 新增软件 = SOFTWARE_NAMES 加成员 + resources/plugins/<软件>/ 放模板 + 此处补一个 adapter
 * （hooks 系平台脚本共用 resources/plugins/hooks/，实现进 hooksAdapter.ts）。
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import type { PlatformInstallResult, PlatformStatus } from '@common/types/integrations'
import { isSoftwareName, type SoftwareName } from '@common/types/trafficLight'
import {
  checkClaude,
  checkCodex,
  checkZcode,
  installClaude,
  installCodex,
  installZcode,
  uninstallClaude,
  uninstallCodex,
  uninstallZcode
} from './hooksAdapter'

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

/** adapter 注册表：键与 SOFTWARE_NAMES 全集对齐 */
const ADAPTERS: Record<SoftwareName, PlatformAdapter> = {
  opencode: { check: checkOpencode, install: installOpencode, uninstall: uninstallOpencode },
  zcode: { check: checkZcode, install: installZcode, uninstall: uninstallZcode },
  claude: { check: checkClaude, install: installClaude, uninstall: uninstallClaude },
  codex: { check: checkCodex, install: installCodex, uninstall: uninstallCodex }
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
