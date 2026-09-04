/**
 * 软件事件接入配置（main 进程）：按软件分发「接入配置检查 / 安装」。
 * 接入的含义由各软件 adapter 决定：opencode = 把内置插件模板复制到其全局插件目录
 * （官方约定启动自动加载，无需注册 opencode.json）。
 * 新增软件 = SOFTWARE_NAMES 加成员 + resources/plugins/<软件>/ 放模板 + 此处补一个 adapter。
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import type { PlatformInstallResult, PlatformStatus, SoftwareName } from '@common/types/trafficLight'
import { isSoftwareName } from './trafficLightConfig'

/** 接入 adapter：check 判定三态，install 覆盖安装（均不抛错，结果对象返回） */
interface PlatformAdapter {
  check(): PlatformStatus
  install(): PlatformInstallResult
}

/** 内置插件模板路径（resources 整体 asarUnpack，dev/打包均以 __dirname 相对定位） */
const OPENCODE_PLUGIN_TEMPLATE = join(
  __dirname,
  '../../resources/plugins/opencode/mistrelle-traffic-light.js'
)

/** opencode 全局插件目录（~/.config/opencode/plugins/，跨平台一致） */
function opencodePluginFile(): string {
  return join(app.getPath('home'), '.config', 'opencode', 'plugins', 'mistrelle-traffic-light.js')
}

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
    return { ok: true, path }
  } catch (error) {
    return { ok: false, msg: '插件安装失败：' + (error as Error).message, path }
  }
}

/** adapter 注册表：键与 SOFTWARE_NAMES 全集对齐 */
const ADAPTERS: Record<SoftwareName, PlatformAdapter> = {
  opencode: { check: checkOpencode, install: installOpencode }
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
