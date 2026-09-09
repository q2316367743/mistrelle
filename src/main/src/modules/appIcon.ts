/**
 * 应用图标提取（main 进程，纯 Node 进程内实现）：为「打开应用」下拉提供图标，
 * 本地 server /icon/app 路由消费。
 * macOS：读 .app 包内 Contents/Resources/*.icns（多个取文件最大），解析 icns 容器
 *   提取内嵌 PNG chunk（ic07+ 均为 PNG 编码，优先 64~256px 段最大者）——
 *   **不走外部进程**：qlmanage 依赖 QuickLook XPC 实测会挂起（提取超时 404），
 *   app.getFileIcon 因 NSImage 断言崩溃全库禁用（见 docs/app/01）。
 *   无 .icns 的应用回退取 Resources 下最大 *.png；都没有返回 null（前端首字母占位）。
 * Windows：PowerShell ExtractAssociatedIcon（.lnk 先解析目标再提取），best-effort。
 * 产物落 ~/.mistrelle/cache/app-icons/<md5(路径)>.png 永久缓存。
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import type { Dirent } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { app } from 'electron'

/** 图标 PNG 缓存路径（路径为键，应用更新不主动失效——图标变化极低频，可手动删缓存目录） */
function iconCachePath(appPath: string): string {
  const hash = createHash('md5').update(appPath).digest('hex')
  return join(app.getPath('home'), '.mistrelle', 'cache', 'app-icons', `${hash}.png`)
}

/** 取应用图标 PNG；缓存命中直读，miss 现提取，失败返回 null */
export async function iconPngForApp(appPath: string): Promise<Buffer | null> {
  if (!appPath) return null
  const target = iconCachePath(appPath)
  if (existsSync(target)) return readFileSync(target)
  const png =
    process.platform === 'darwin'
      ? extractMacIcon(appPath)
      : process.platform === 'win32'
        ? await extractWindowsIcon(appPath, target)
        : null
  if (!png) return null
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, png)
  return png
}

/** icns PNG chunk 的类型 → 像素尺寸（仅 PNG 编码的类型；未知类型按 0 记） */
const ICNS_PNG_SIZES: Record<string, number> = {
  icp4: 16,
  icp5: 32,
  icp6: 64,
  icp7: 128,
  ic07: 128,
  ic08: 256,
  ic09: 512,
  ic10: 1024,
  ic11: 32,
  ic12: 64,
  ic13: 256,
  ic14: 512
}

/** 解析 icns 容器，返回内嵌 PNG chunk（非 PNG 编码的旧 chunk 一律跳过） */
function pngChunksFromIcns(buf: Buffer): Array<{ size: number; png: Buffer }> {
  if (buf.length < 8 || buf.toString('ascii', 0, 4) !== 'icns') return []
  const chunks: Array<{ size: number; png: Buffer }> = []
  let offset = 8
  while (offset + 8 <= buf.length) {
    const type = buf.toString('ascii', offset, offset + 4)
    const len = buf.readUInt32BE(offset + 4)
    if (len < 8 || offset + len > buf.length) break
    const data = buf.subarray(offset + 8, offset + len)
    // PNG 魔数校验：只认真实 PNG 数据（ARGB/JPEG2000 等旧编码不处理）
    if (data.length > 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e) {
      chunks.push({ size: ICNS_PNG_SIZES[type] ?? 0, png: data })
    }
    offset += len
  }
  return chunks
}

/** 从 chunk 列表选显示合适的：优先 64~256px 段最大者（18px 下拉图标清晰且文件小） */
function pickIconPng(chunks: Array<{ size: number; png: Buffer }>): Buffer | null {
  if (chunks.length === 0) return null
  const midSize = chunks.filter((c) => c.size >= 64 && c.size <= 256)
  const pool = midSize.length > 0 ? midSize : chunks
  return Buffer.from(pool.reduce((best, cur) => (cur.size > best.size ? cur : best)).png)
}

function fileSize(path: string): number {
  try {
    return statSync(path).size
  } catch {
    return 0
  }
}

function readFirstFile(paths: string[]): Buffer | null {
  for (const path of paths) {
    try {
      return readFileSync(path)
    } catch {
      // 单文件读取失败继续下一个
    }
  }
  return null
}

/**
 * macOS 提取：Resources 下 *.icns 取文件最大者解析内嵌 PNG；无 icns 时回退取
 * Resources 下最大 *.png（部分应用直接放位图）。纯文件读取，毫秒级。
 */
function extractMacIcon(appPath: string): Buffer | null {
  const resources = join(appPath, 'Contents', 'Resources')
  let entries: Dirent[]
  try {
    entries = readdirSync(resources, { withFileTypes: true })
  } catch {
    return null
  }
  const files = entries.filter((e) => e.isFile()).map((e) => e.name)
  const icnsFiles = files
    .filter((name) => name.endsWith('.icns'))
    .sort((a, b) => fileSize(join(resources, b)) - fileSize(join(resources, a)))
  for (const name of icnsFiles) {
    try {
      const png = pickIconPng(pngChunksFromIcns(readFileSync(join(resources, name))))
      if (png) return png
    } catch {
      // 该 icns 损坏则尝试下一个
    }
  }
  const pngFile = files
    .filter((name) => name.endsWith('.png'))
    .sort((a, b) => fileSize(join(resources, b)) - fileSize(join(resources, a)))[0]
  if (!pngFile) return null
  return readFirstFile([join(resources, pngFile)])
}

/** 执行外部工具（数组参数无 shell、无引号问题），超时/启动失败/非 0 退出一律 false（Windows 专用） */
function runTool(command: string, args: string[], timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'ignore' })
    const timer = setTimeout(() => {
      child.kill()
      resolve(false)
    }, timeoutMs)
    child.on('error', () => {
      clearTimeout(timer)
      resolve(false)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve(code === 0)
    })
  })
}

/**
 * Windows 提取：PowerShell 脚本落临时 .ps1 后 -File 执行（不经 cliRun——其单引号
 * quote 不被 cmd 识别）；.lnk 先经 WScript.Shell 解析目标路径，提取失败 best-effort 返回 null。
 */
async function extractWindowsIcon(appPath: string, target: string): Promise<Buffer | null> {
  const scriptPath = join(tmpdir(), `mistrelle-icon-${basename(target, '.png')}.ps1`)
  const esc = (text: string): string => text.replaceAll("'", "''")
  const script = [
    'Add-Type -AssemblyName System.Drawing',
    `$p = '${esc(appPath)}'`,
    '$t = $p',
    "if ($p.ToLower().EndsWith('.lnk')) { try { $t = (New-Object -ComObject WScript.Shell).CreateShortcut($p).TargetPath } catch {} }",
    'if (-not $t) { $t = $p }',
    '$i = [System.Drawing.Icon]::ExtractAssociatedIcon($t)',
    'if ($null -eq $i) { exit 1 }',
    `$i.ToBitmap().Save('${esc(target)}', [System.Drawing.Imaging.ImageFormat]::Png)`
  ].join(';\n')
  try {
    writeFileSync(scriptPath, script, 'utf-8')
    mkdirSync(dirname(target), { recursive: true })
    const ok = await runTool(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      15_000
    )
    return ok && existsSync(target) ? readFileSync(target) : null
  } catch {
    return null
  } finally {
    try {
      rmSync(scriptPath, { force: true })
    } catch {
      // 清理失败不影响结果
    }
  }
}
