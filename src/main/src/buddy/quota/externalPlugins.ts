/**
 * 第三方额度插件（插件目录 ~/.mistrelle/buddy/plugins）：目录归用户，应用只读扫描不写入。
 * 「安装第三方插件」= 把单文件 .js（definePlugin 契约，与内置一致）放进目录；
 * 替换文件即更新，下次执行自动生效，列表经 listPlugins 刷新。
 * 未来「在线插件列表 + 版本 → 下载到目录本地更新」复用此模型，本文件不涉及在线接口。
 */
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'fs'
import type { Dirent } from 'node:fs'
import { join } from 'path'
import { app } from 'electron'
import type { QuotaPluginDescriptor } from '@common/types/quota'
import { collectQuotaPlugin } from './quotaRunner'

const PLUGINS_DIR_NAME = 'plugins'

/** 插件文件名白名单：单段安全文件名且以 .js 结尾（防路径穿越，normalize 与扫描共用） */
export function isSafePluginFile(name: string): boolean {
  return /^[A-Za-z0-9._-]+\.js$/.test(name)
}

function pluginsDir(): string {
  return join(app.getPath('home'), '.mistrelle', 'buddy', PLUGINS_DIR_NAME)
}

/** 确保插件目录存在（openPluginsDir 前置；目录惰性创建） */
export function ensurePluginsDir(): string {
  const dir = pluginsDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

/** 读取单个插件脚本源码（执行时调用；文件不存在/读失败抛错由调用方容错） */
export function readPluginCode(file: string): string {
  if (!isSafePluginFile(file)) throw new Error(`非法插件文件名：${file}`)
  return readFileSync(join(pluginsDir(), file), 'utf-8')
}

/** 扫描插件目录：每个 .js 收集 manifest 元数据，失败记 error（不拖垮其他插件） */
export function scanExternalPlugins(): QuotaPluginDescriptor[] {
  const dir = pluginsDir()
  if (!existsSync(dir)) return []
  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true }) as Dirent[]
  } catch {
    return []
  }
  const descriptors: QuotaPluginDescriptor[] = []
  for (const entry of entries) {
    if (!entry.isFile() || !isSafePluginFile(entry.name)) continue
    descriptors.push(loadExternalDescriptor(entry.name))
  }
  return descriptors
}

/** 加载单个第三方插件的元数据（语法错误/契约不符 → error 描述符） */
function loadExternalDescriptor(file: string): QuotaPluginDescriptor {
  const base: QuotaPluginDescriptor = {
    source: 'external',
    key: file,
    id: file,
    name: file,
    settings: []
  }
  try {
    const manifest = collectQuotaPlugin(readPluginCode(file))
    return {
      ...base,
      id: manifest.id || file,
      name: manifest.name || manifest.id || file,
      settings: manifest.settings ?? []
    }
  } catch (e) {
    return { ...base, name: file, error: '插件加载失败：' + (e as Error).message }
  }
}
