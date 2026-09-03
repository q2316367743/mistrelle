/**
 * 字体模块（main 进程）：系统字体枚举 + 资源库字体管理。
 * 原 src-utools/src/font.js 的 TS 移植，name 表解析拆至 ./parser。
 *
 * 两个数据源，统一输出 { name, path, source }：
 * - 系统字体：扫描系统字体目录，解析 name 表，缓存到 ~/.mistrelle/font-cache.json；启动后台异步刷新
 * - 资源库：~/.mistrelle/assets/fonts/ 下的字体文件，索引记录在 ~/.mistrelle/assets/index.json
 */
import { homedir } from 'node:os'
import { join, basename, extname } from 'node:path'
import { existsSync } from 'node:fs'
import { readdir, readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises'
import { parseFontFamilyName } from './parser'

export type FontSource = 'system' | 'library' | 'online'

/** 五维分类元数据（main 侧不校验枚举值，透传 renderer 的字符串） */
export interface FontMeta {
  type?: string
  style?: string
  weight?: string
  license?: string
  language?: string
}

export interface FontItem {
  name: string
  path: string
  source: FontSource
  meta?: FontMeta
}

const HOME = homedir()
const DATA_DIR = join(HOME, '.mistrelle')
const FONT_CACHE_PATH = join(DATA_DIR, 'data', 'font-cache.json')
const ASSETS_DIR = join(DATA_DIR, 'assets')
const LIB_FONTS_DIR = join(ASSETS_DIR, 'fonts')
const LIB_INDEX_PATH = join(ASSETS_DIR, 'index.json')

const FONT_EXT = ['.ttf', '.otf', '.ttc', '.otc', '.woff', '.woff2']

const META_KEYS = ['type', 'style', 'weight', 'license', 'language']

/** 系统字体条目（meta 由用户手动指定，随缓存持久化） */
interface SystemFont {
  name: string
  path: string
  meta?: FontMeta
}

/** 元数据清洗：仅保留五维且非空、非「全部」的字符串值；无有效字段返回 undefined（即未指定） */
const sanitizeMeta = (meta: Partial<FontMeta> | null | undefined): FontMeta | undefined => {
  if (!meta || typeof meta !== 'object') return undefined
  const out: FontMeta = {}
  for (const k of META_KEYS) {
    const v = (meta as Record<string, unknown>)[k]
    if (typeof v === 'string' && v && v !== '全部') out[k as keyof FontMeta] = v
  }
  return Object.keys(out).length ? out : undefined
}

// ── 系统字体枚举 + 缓存 ─────────────────────────────────────

const getSystemFontDirs = (): string[] => {
  switch (process.platform) {
    case 'win32':
      return [join(process.env.WINDIR || 'C:\\Windows', 'Fonts')]
    case 'darwin':
      return [
        '/System/Library/Fonts',
        '/System/Library/Fonts/Supplemental',
        '/Library/Fonts',
        join(HOME, 'Library', 'Fonts')
      ]
    default:
      return [
        '/usr/share/fonts',
        '/usr/local/share/fonts',
        join(HOME, '.local/share/fonts'),
        join(HOME, '.fonts')
      ]
  }
}

/** 递归收集目录下的字体文件（深度 ≤3，防御深层嵌套） */
const walkFontDirs = async (dirs: string[], depth = 0): Promise<string[]> => {
  const out: string[] = []
  for (const dir of dirs) {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory() && depth < 3) out.push(...(await walkFontDirs([full], depth + 1)))
      else if (entry.isFile() && FONT_EXT.includes(extname(entry.name).toLowerCase()))
        out.push(full)
    }
  }
  return out
}

const scanSystemFonts = async (): Promise<SystemFont[]> => {
  const files = await walkFontDirs(getSystemFontDirs())
  const seen = new Set<string>()
  const fonts: SystemFont[] = []
  for (const file of files) {
    const name = await parseFontFamilyName(file)
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    fonts.push({ name, path: file })
  }
  fonts.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
  return fonts
}

const loadSystemFontsFromCache = async (): Promise<SystemFont[] | null> => {
  try {
    const data = JSON.parse(await readFile(FONT_CACHE_PATH, 'utf-8')) as {
      fonts?: SystemFont[]
    }
    if (data && Array.isArray(data.fonts)) return data.fonts
  } catch {
    // 缓存缺失 / 损坏：走全量扫描
  }
  return null
}

let systemFontsCache: SystemFont[] | null = null
let refreshing: Promise<void> | null = null

/** font-cache.json 串行写（后台刷新 / updateFontMeta 并发时防相互覆盖） */
let cacheQueue: Promise<unknown> = Promise.resolve()
const withCacheLock = <T>(fn: () => Promise<T>): Promise<T> => {
  const run = cacheQueue.then(fn, fn)
  cacheQueue = run.catch(() => {})
  return run
}

const writeFontCache = async (fonts: SystemFont[]): Promise<void> => {
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(
    FONT_CACHE_PATH,
    JSON.stringify({ version: 1, updatedAt: Date.now(), fonts }),
    'utf-8'
  )
}

/**
 * 扫描系统字体并写回缓存（后台任务，只执行一次，可并发等待）。
 * 重扫会剔除已删除字体；用户手动设置的 meta 按族名合并保留（被删字体的 meta 一并清除）。
 */
const refreshSystemFonts = (): Promise<void> => {
  if (refreshing) return refreshing
  refreshing = (async () => {
    try {
      const fonts = await scanSystemFonts()
      await withCacheLock(async () => {
        const prevMeta = new Map<string, FontMeta>()
        for (const f of systemFontsCache ?? []) {
          if (f.meta) prevMeta.set(f.name.toLowerCase(), f.meta)
        }
        for (const f of fonts) {
          const m = prevMeta.get(f.name.toLowerCase())
          if (m) f.meta = m
        }
        systemFontsCache = fonts
        await writeFontCache(fonts)
      })
    } catch (e) {
      console.error('[font] 系统字体缓存刷新失败', e)
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

// 模块加载即启动后台刷新（满足「每次启动刷新」，不阻塞调用方）
void refreshSystemFonts()

/** 系统字体列表：有缓存立即返回并后台刷新；无缓存（首次）等待全量扫描 */
const listSystemFonts = async (): Promise<SystemFont[]> => {
  if (systemFontsCache === null) {
    systemFontsCache = await loadSystemFontsFromCache()
    if (systemFontsCache === null) {
      await refreshSystemFonts()
      return systemFontsCache ?? []
    }
    void refreshSystemFonts()
  }
  return systemFontsCache
}

// ── 资源库（index.json 索引）────────────────────────────────

interface LibraryItem {
  name: string
  path: string
  source: FontSource
  meta?: FontMeta
  addedAt?: number
}

const readIndex = async (): Promise<LibraryItem[]> => {
  try {
    const data = JSON.parse(await readFile(LIB_INDEX_PATH, 'utf-8')) as { fonts?: LibraryItem[] }
    if (data && Array.isArray(data.fonts)) return data.fonts
  } catch {
    // 索引缺失 / 损坏：视为空库
  }
  return []
}

const writeIndex = async (fonts: LibraryItem[]): Promise<void> => {
  await mkdir(ASSETS_DIR, { recursive: true })
  await writeFile(
    LIB_INDEX_PATH,
    JSON.stringify({ version: 1, updatedAt: Date.now(), fonts }, null, 2),
    'utf-8'
  )
}

// index.json 串行写（addFont / removeFont 并发时防相互覆盖）
let indexQueue: Promise<unknown> = Promise.resolve()
const withIndexLock = <T>(fn: () => Promise<T>): Promise<T> => {
  const run = indexQueue.then(fn, fn)
  indexQueue = run.catch(() => {})
  return run
}

/** 资源库字体列表：读 index.json + readdir(fonts/) 存在性校验，零解析 */
const listLibrary = async (): Promise<FontItem[]> => {
  const fonts = await readIndex()
  if (!fonts.length) return []
  let fileNames = new Set<string>()
  try {
    fileNames = new Set(await readdir(LIB_FONTS_DIR))
  } catch {
    // 目录不存在：全部失效
  }
  const out: FontItem[] = []
  for (const f of fonts) {
    if (!fileNames.has(basename(f.path))) continue
    const item: FontItem = {
      name: f.name,
      path: join(ASSETS_DIR, f.path),
      source: f.source === 'online' ? 'online' : 'library'
    }
    if (f.meta) item.meta = f.meta
    out.push(item)
  }
  return out
}

/** 将字体文件入库：解析族名（失败回退文件名）→ 拷贝到 fonts/ → 写 index.json；meta 可选一并持久化 */
const addFont = async (
  srcPath: string,
  meta: Partial<FontMeta> | null = null
): Promise<FontItem | { error?: string }> => {
  const ext = extname(srcPath).toLowerCase()
  if (!FONT_EXT.includes(ext)) {
    return { error: `不支持的字体格式 ${ext || '(无扩展名)'}，仅支持 ${FONT_EXT.join(' / ')}` }
  }
  if (!existsSync(srcPath)) return { error: `字体文件不存在：${srcPath}` }
  let name = await parseFontFamilyName(srcPath)
  const base = basename(srcPath, ext)
  if (!name) name = base
  const safeName = name.replace(/[\\/:*?"<>|]/g, '_') || base
  await mkdir(LIB_FONTS_DIR, { recursive: true })
  const target = join(LIB_FONTS_DIR, `${safeName}${ext}`)
  await copyFile(srcPath, target)
  const cleanMeta = sanitizeMeta(meta)
  return withIndexLock(async () => {
    const fonts = await readIndex()
    const item: LibraryItem = {
      name,
      path: `fonts/${basename(target)}`,
      source: 'library',
      addedAt: Date.now()
    }
    if (cleanMeta) item.meta = cleanMeta
    const idx = fonts.findIndex((f) => f.name === name)
    if (idx >= 0) fonts[idx] = item
    else fonts.push(item)
    await writeIndex(fonts)
    const out: FontItem = { name, path: target, source: 'library' }
    if (cleanMeta) out.meta = cleanMeta
    return out
  })
}

/** 从资源库移除字体：删 index 条目 + 删文件 */
const removeFont = async (
  name: string
): Promise<{ removed?: boolean; name?: string; error?: string }> => {
  return withIndexLock(async () => {
    const fonts = await readIndex()
    const idx = fonts.findIndex((f) => f.name === name)
    if (idx < 0) return { error: `资源库中不存在字体「${name}」` }
    const [removed] = fonts.splice(idx, 1)
    await writeIndex(fonts)
    try {
      const full = join(ASSETS_DIR, removed.path)
      if (existsSync(full)) await rm(full)
    } catch {
      // 文件删除失败不影响索引
    }
    return { removed: true, name }
  })
}

/**
 * 更新字体分类元数据（资源库字体写 assets/index.json，系统字体写 font-cache.json）。
 * meta 传 undefined / 空对象即清除持久化值，之后渲染层回退启发式推断。
 */
const updateFontMeta = async (
  name: string,
  meta: Partial<FontMeta> | null | undefined
): Promise<{ name?: string; meta?: FontMeta; error?: string }> => {
  const cleanMeta = sanitizeMeta(meta)
  const lib = await withIndexLock(async () => {
    const fonts = await readIndex()
    const idx = fonts.findIndex((f) => f.name === name)
    if (idx < 0) return null
    if (cleanMeta) fonts[idx].meta = cleanMeta
    else delete fonts[idx].meta
    await writeIndex(fonts)
    return { name, meta: cleanMeta }
  })
  if (lib) return lib
  const sys = await withCacheLock(async () => {
    const list = systemFontsCache ?? (await loadSystemFontsFromCache())
    if (!list) return null
    const idx = list.findIndex((f) => f.name === name)
    if (idx < 0) return null
    if (cleanMeta) list[idx].meta = cleanMeta
    else delete list[idx].meta
    systemFontsCache = list
    await writeFontCache(list)
    return { name, meta: cleanMeta }
  })
  if (sys) return sys
  return { error: `字体「${name}」不存在于资源库或系统缓存` }
}

// ── 对外输出 ────────────────────────────────────────────────

/** 合并系统字体 + 资源库字体，统一 { name, path, source, meta? }；资源库同名覆盖系统 */
export const listFonts = async (): Promise<FontItem[]> => {
  const [system, library] = await Promise.all([listSystemFonts(), listLibrary()])
  const merged = new Map<string, FontItem>()
  for (const f of system) {
    merged.set(f.name, {
      name: f.name,
      path: f.path,
      source: 'system',
      ...(f.meta ? { meta: f.meta } : {})
    })
  }
  for (const f of library) merged.set(f.name, f)
  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh'))
}

export const listSystemFontsApi = listSystemFonts
export const listLibraryApi = listLibrary
export const addFontApi = addFont
export const removeFontApi = removeFont
export const updateFontMetaApi = updateFontMeta
export const parseFontFamilyNameApi = parseFontFamilyName

/** 读取字体文件二进制，供渲染进程 new FontFace(name, buffer) */
export const readFont = async (filePath: string): Promise<ArrayBuffer> => {
  const buf = await readFile(filePath)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

/** 资源库目录（供资源管理页展示路径） */
export const getAssetsDir = (): string => ASSETS_DIR

/** 系统字体缓存文件路径 */
export const getFontCachePath = (): string => FONT_CACHE_PATH
