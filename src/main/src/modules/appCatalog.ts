/**
 * 本机应用目录（main 进程）：扫描系统应用清单，供「打开应用」动作的下拉选择。
 * macOS：/Applications、/System/Applications 及各自 Utilities 子目录、~/Applications
 *   的顶层 *.app（名称取目录名去后缀；不解析 Info.plist，展示名与目录名差异可接受）。
 * Windows：开始菜单 Programs（全用户 + 当前用户）递归 *.lnk——shell.openPath 可直接打开
 *   快捷方式，无需解析目标。
 * 每次调用现扫（目录顶层 readdir，毫秒级），无缓存；拿不到的目录（不存在/无权限）静默跳过。
 */
import { readdirSync } from 'node:fs'
import type { Dirent } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AppCatalogItem } from '@common/types/keypad'

/** 本机已安装应用清单（按名称排序） */
export function listInstalledApps(): AppCatalogItem[] {
  const apps = process.platform === 'darwin' ? listMacApps() : process.platform === 'win32' ? listWindowsApps() : []
  apps.sort((a, b) => a.name.localeCompare(b.name))
  return apps
}

function listMacApps(): AppCatalogItem[] {
  const dirs = [
    '/Applications',
    '/Applications/Utilities',
    '/System/Applications',
    '/System/Applications/Utilities',
    join(homedir(), 'Applications')
  ]
  const apps: AppCatalogItem[] = []
  const seen = new Set<string>()
  for (const dir of dirs) {
    let entries: Dirent[]
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.endsWith('.app')) continue
      const path = join(dir, entry.name)
      if (seen.has(path)) continue
      seen.add(path)
      apps.push({ name: entry.name.slice(0, -'.app'.length), path })
    }
  }
  return apps
}

function listWindowsApps(): AppCatalogItem[] {
  const roots = [
    join(process.env['ProgramData'] ?? 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    join(process.env['AppData'] ?? '', 'Microsoft', 'Windows', 'Start Menu', 'Programs')
  ]
  const apps: AppCatalogItem[] = []
  const seen = new Set<string>()
  const walk = (dir: string): void => {
    let entries: Dirent[]
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(path)
        continue
      }
      if (!entry.name.toLowerCase().endsWith('.lnk')) continue
      if (seen.has(path)) continue
      seen.add(path)
      apps.push({ name: entry.name.slice(0, -'.lnk'.length), path })
    }
  }
  for (const root of roots) walk(root)
  return apps
}
