/**
 * 工作条应用扫描器（darwin）：扫描系统应用目录；图标从 .app 包内自解析，绝不调用 app.getFileIcon。
 *
 * 崩溃约束（2026-08-29 两次 macOS 崩溃报告实锤）：app.getFileIcon 在 macOS 26.5 × Electron 39.8.10
 * 上会在 Chromium 线程池（ThreadPoolForegroundWorker）内触发 NSImage 断言崩溃（SIGTRAP brk 0，
 * 两次崩溃同一原生偏移，且 JS 层面串行化亦无法规避——该 API 内部仍并发做 NSImage 操作）。
 * 根治：不调用 app.getFileIcon，改读 Contents/Resources/*.icns 自解析 PNG（纯 Buffer 解析，无 AppKit/NSImage）。
 *
 * 相应约定：
 * - 列表（getInstalledApps）不携带图标，返回 icon:''；
 * - 图标经 getAppIconPng 以模块级 promise 链严格串行获取，失败缓存占位防重试风暴；
 * - 协议 handler（protocol.ts）调 getAppIconPng 服务 mistrelle://icon/<target>。
 */
import { readFile, readdir } from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import { homedir } from 'os'
import { join } from 'path'
import type { ToolbarItem } from '~/ipc/toolbarChannels'

// 扫描顺序即覆盖优先级：同名应用由后扫描的目录（用户目录）覆盖系统目录
const SCAN_DIRS = ['/System/Applications', '/Applications', join(homedir(), 'Applications')]

interface ScannedApp {
  name: string
  path: string
}

async function scanAppPaths(): Promise<ScannedApp[]> {
  if (process.platform !== 'darwin') return []
  const pathByName = new Map<string, string>()
  for (const dir of SCAN_DIRS) {
    let entries: Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      continue // 目录不存在（如未创建 ~/Applications）直接跳过
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.endsWith('.app')) continue
      pathByName.set(entry.name.slice(0, -'.app'.length), join(dir, entry.name))
    }
  }
  return [...pathByName.entries()]
    .map(([name, path]) => ({ name, path }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

let cached: Promise<ToolbarItem[]> | null = null

/** 获取已安装应用列表（进程内缓存，应用重启前不重扫；不带图标，避免启动即取图） */
export function getInstalledApps(): Promise<ToolbarItem[]> {
  if (!cached) {
    cached = scanAppPaths().then((apps) =>
      apps.map(({ name, path }) => ({ type: 'app', name, target: path, icon: '' }))
    )
    cached.catch(() => {
      cached = null // 失败允许下次调用重试
    })
  }
  return cached
}

/**
 * 从 icns 容器解析出最大的内嵌 PNG 载荷。
 * icns 格式：8 字节头（'icns' + 总长）后跟若干 chunk（type 4B + length 4B 大端 + data）。
 * 现代 icon 的 ic07~ic14 chunk 其 data 直接就是完整 PNG 文件（老式 ic04/ic05 为 JPEG2000，跳过）。
 */
function extractIcnsPng(data: Buffer): Buffer | null {
  if (data.length < 8 || data.readUInt32BE(0) !== 0x69636e73) return null // magic 'icns'
  let offset = 8
  let best: Buffer | null = null
  while (offset + 8 <= data.length) {
    const type = data.toString('ascii', offset, offset + 4)
    const length = data.readUInt32BE(offset + 4)
    if (length < 8 || offset + length > data.length) break
    const payload = data.subarray(offset + 8, offset + length)
    if (
      /^ic(0[7-9]|1[0-4])$/.test(type) &&
      payload.length >= 8 &&
      payload[0] === 0x89 &&
      payload[1] === 0x50 &&
      payload[2] === 0x4e &&
      payload[3] === 0x47
    ) {
      if (!best || payload.length > best.length) best = payload
    }
    offset += length
  }
  return best
}

/** 读取 .app 包内图标：优先 Contents/Resources/AppIcon.icns，其次任意 .icns，解析失败返回 null */
async function readIcnsPng(appPath: string): Promise<Buffer | null> {
  const resourcesDir = join(appPath, 'Contents', 'Resources')
  let entries: Dirent[]
  try {
    entries = await readdir(resourcesDir, { withFileTypes: true })
  } catch {
    return null // 无 Resources（或非标准 .app），交给首字母头像兜底
  }
  const icnsNames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.icns'))
    .map((entry) => entry.name)
    .sort((a, b) => {
      const weight = (name: string): number => (name === 'AppIcon.icns' ? 0 : 1)
      return weight(a) - weight(b) || a.localeCompare(b)
    })
  for (const name of icnsNames) {
    try {
      const png = extractIcnsPng(await readFile(join(resourcesDir, name)))
      if (png) return png
    } catch {
      // 单文件读取失败尝试下一个
    }
  }
  return null
}

const ICON_FAILED: unique symbol = Symbol('icon-failed')
type IconEntry = Buffer | typeof ICON_FAILED
const iconCache = new Map<string, IconEntry>()
let iconQueue: Promise<unknown> = Promise.resolve()

/** 取应用图标 PNG 字节（严格串行单飞，进程内缓存，纯读盘+自解析）；失败/不存在返回 null */
export function getAppIconPng(target: string): Promise<Buffer | null> {
  const hit = iconCache.get(target)
  if (hit !== undefined) return Promise.resolve(hit === ICON_FAILED ? null : hit)
  const task = iconQueue.then(async () => {
    // 排队期间同 target 可能已被前序请求写入
    const again = iconCache.get(target)
    if (again !== undefined) return again === ICON_FAILED ? null : again
    try {
      const png = await readIcnsPng(target)
      if (!png) {
        iconCache.set(target, ICON_FAILED)
        return null
      }
      iconCache.set(target, png)
      return png
    } catch {
      iconCache.set(target, ICON_FAILED)
      return null
    }
  })
  // 队列持续推进，单次失败不阻断后续请求
  iconQueue = task.catch(() => undefined)
  return task
}