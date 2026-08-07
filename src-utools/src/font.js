/**
 * 字体模块：系统字体枚举 + 资源库字体管理。
 *
 * 两个数据源，统一输出 { name, path, source }：
 * - 系统字体：扫描系统字体目录，解析 TTF/OTF/TTC 的 name 表（nameID=1/16 家族名），
 *   结果缓存到 ~/.mistrelle/font-cache.json；启动时后台异步刷新，读缓存立即返回（二次启动零等待）。
 * - 资源库：~/.mistrelle/assets/fonts/ 下的字体文件，索引记录在 ~/.mistrelle/assets/index.json。
 *   启动时只做「文件存在性校验」（readDir 对比文件名），不再解析字体文件，极大简化效率。
 *   source 预留 'online'（在线字体未来下载到 fonts/ 并标记，此版不实现）。
 *
 * 渲染统一入口：system → Chromium 原生可用；library/online → 渲染进程 new FontFace。
 */
const os = require('node:os')
const path = require('node:path')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const iconv = require('iconv-lite')

const HOME = os.homedir()
const DATA_DIR = path.join(HOME, '.mistrelle')
const FONT_CACHE_PATH = path.join(DATA_DIR, 'font-cache.json')
const ASSETS_DIR = path.join(DATA_DIR, 'assets')
const LIB_FONTS_DIR = path.join(ASSETS_DIR, 'fonts')
const LIB_INDEX_PATH = path.join(ASSETS_DIR, 'index.json')

const FONT_EXT = ['.ttf', '.otf', '.ttc', '.otc', '.woff', '.woff2']

const readU16 = (buf, off) => buf.readUInt16BE(off)
const readU32 = (buf, off) => buf.readUInt32BE(off)

// ── name 表解析（TTF/OTF/TTC）─────────────────────────────────

/** 从 fd 的指定偏移读取若干字节（超出文件时返回实际读到的部分） */
const readRange = async (fd, offset, length) => {
  const buf = Buffer.alloc(length)
  const { bytesRead } = await fd.read(buf, 0, length, offset)
  return buf.subarray(0, bytesRead)
}

/** 解析 name 表（偏移相对本表起点），返回家族名 */
const parseNameTable = (buf) => {
  if (buf.length < 6) return null
  const count = readU16(buf, 2)
  const stringOffset = readU16(buf, 4)
  // 优先级：nameID=16 排版家族 > nameID=1 家族；platformID=3(Windows)+lang=0x409 > 3/0(Unicode) > 1(Mac)
  const candidates = []
  for (let i = 0; i < count; i++) {
    const rec = 6 + i * 12
    if (rec + 12 > buf.length) break
    const platformID = readU16(buf, rec)
    const encodingID = readU16(buf, rec + 2)
    const languageID = readU16(buf, rec + 4)
    const nameID = readU16(buf, rec + 6)
    const length = readU16(buf, rec + 8)
    const offset = readU16(buf, rec + 10)
    if (nameID !== 1 && nameID !== 16) continue
    const start = stringOffset + offset
    if (start + length > buf.length) continue
    const strBuf = buf.subarray(start, start + length)
    let text = null
    if (platformID === 3 && encodingID === 1) text = iconv.decode(strBuf, 'utf-16be')
    else if (platformID === 0) text = iconv.decode(strBuf, 'utf-16be')
    else if (platformID === 1) text = iconv.decode(strBuf, 'macintosh')
    if (!text || !text.trim()) continue
    const priority =
      (nameID === 16 ? 0 : 10) +
      (platformID === 3 && encodingID === 1 && languageID === 0x409 ? 0 : platformID === 3 || platformID === 0 ? 1 : 2)
    candidates.push({ priority, text: text.trim() })
  }
  if (!candidates.length) return null
  candidates.sort((a, b) => a.priority - b.priority)
  return candidates[0].text
}

/** 解析单个 sfnt 字体（TTC 内的 table offset 是相对文件开头的绝对偏移，不再加 sfntOffset） */
const parseSfntFamilyName = async (fd, sfntOffset) => {
  const head = await readRange(fd, sfntOffset, 12)
  if (head.length < 12) return null
  const numTables = readU16(head, 4)
  const dir = await readRange(fd, sfntOffset + 12, numTables * 16)
  if (dir.length < numTables * 16) return null
  let nameOffset = 0
  let nameLength = 0
  for (let i = 0; i < numTables; i++) {
    const rec = dir.subarray(i * 16, i * 16 + 16)
    if (rec.toString('ascii', 0, 4) === 'name') {
      nameOffset = readU32(rec, 8)
      nameLength = readU32(rec, 12)
      break
    }
  }
  if (!nameOffset || !nameLength) return null
  const nameBuf = await readRange(fd, nameOffset, nameLength)
  return parseNameTable(nameBuf)
}

/** 解析字体文件家族名；无法解析返回 null（WOFF/WOFF2 内部结构不同，返回 null） */
const parseFontFamilyName = async (filePath) => {
  let fd
  try {
    fd = await fsp.open(filePath, 'r')
    const head = await readRange(fd, 0, 12)
    if (head.length < 12) return null
    const tag = head.toString('ascii', 0, 4)
    if (tag === 'ttcf') {
      const ttcHead = await readRange(fd, 0, 16)
      if (ttcHead.length < 12) return null
      const numFonts = readU32(ttcHead, 8)
      const offsetsBuf = await readRange(fd, 12, numFonts * 4)
      for (let i = 0; i < numFonts; i++) {
        const name = await parseSfntFamilyName(fd, readU32(offsetsBuf, i * 4))
        if (name) return name
      }
      return null
    }
    if (tag === 'wOFF' || tag === 'wOF2') return null
    return await parseSfntFamilyName(fd, 0)
  } catch {
    return null
  } finally {
    await fd?.close().catch(() => {})
  }
}

// ── 系统字体枚举 + 缓存 ─────────────────────────────────────

const getSystemFontDirs = () => {
  switch (process.platform) {
    case 'win32':
      return [path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts')]
    case 'darwin':
      return [
        '/System/Library/Fonts',
        '/System/Library/Fonts/Supplemental',
        '/Library/Fonts',
        path.join(HOME, 'Library', 'Fonts')
      ]
    default:
      return [
        '/usr/share/fonts',
        '/usr/local/share/fonts',
        path.join(HOME, '.local/share/fonts'),
        path.join(HOME, '.fonts')
      ]
  }
}

/** 递归收集目录下的字体文件（深度 ≤3，防御深层嵌套） */
const walkFontDirs = async (dirs, depth = 0) => {
  const out = []
  for (const dir of dirs) {
    let entries
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory() && depth < 3) out.push(...(await walkFontDirs([full], depth + 1)))
      else if (entry.isFile() && FONT_EXT.includes(path.extname(entry.name).toLowerCase())) out.push(full)
    }
  }
  return out
}

const scanSystemFonts = async () => {
  const files = await walkFontDirs(getSystemFontDirs())
  const seen = new Set()
  const fonts = []
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

const loadSystemFontsFromCache = async () => {
  try {
    const data = JSON.parse(await fsp.readFile(FONT_CACHE_PATH, 'utf-8'))
    if (data && Array.isArray(data.fonts)) return data.fonts
  } catch {
    // 缓存缺失 / 损坏：走全量扫描
  }
  return null
}

let systemFontsCache = null
let refreshing = null

/** 扫描系统字体并写回缓存（后台任务，只执行一次，可并发等待） */
const refreshSystemFonts = () => {
  if (refreshing) return refreshing
  refreshing = (async () => {
    try {
      const fonts = await scanSystemFonts()
      systemFontsCache = fonts
      await fsp.mkdir(DATA_DIR, { recursive: true })
      await fsp.writeFile(
        FONT_CACHE_PATH,
        JSON.stringify({ version: 1, updatedAt: Date.now(), fonts }),
        'utf-8'
      )
    } catch (e) {
      console.error('[font] 系统字体缓存刷新失败', e)
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

// 模块加载即启动后台刷新（满足「每次启动刷新」，不阻塞调用方）
refreshSystemFonts()

/** 系统字体列表：有缓存立即返回并后台刷新；无缓存（首次）等待全量扫描 */
const listSystemFonts = async () => {
  if (systemFontsCache === null) {
    systemFontsCache = await loadSystemFontsFromCache()
    if (systemFontsCache === null) {
      await refreshSystemFonts()
      return systemFontsCache ?? []
    }
    refreshSystemFonts()
  }
  return systemFontsCache
}

// ── 资源库（index.json 索引）────────────────────────────────

const readIndex = async () => {
  try {
    const data = JSON.parse(await fsp.readFile(LIB_INDEX_PATH, 'utf-8'))
    if (data && Array.isArray(data.fonts)) return data.fonts
  } catch {
    // 索引缺失 / 损坏：视为空库
  }
  return []
}

const writeIndex = async (fonts) => {
  await fsp.mkdir(ASSETS_DIR, { recursive: true })
  await fsp.writeFile(
    LIB_INDEX_PATH,
    JSON.stringify({ version: 1, updatedAt: Date.now(), fonts }, null, 2),
    'utf-8'
  )
}

// index.json 串行写（addFont / removeFont 并发时防相互覆盖）
let indexQueue = Promise.resolve()
const withIndexLock = (fn) => {
  const run = indexQueue.then(fn, fn)
  indexQueue = run.catch(() => {})
  return run
}

/** 资源库字体列表：读 index.json + readDir(fonts/) 存在性校验，零解析 */
const listLibrary = async () => {
  const fonts = await readIndex()
  if (!fonts.length) return []
  let fileNames = new Set()
  try {
    fileNames = new Set(await fsp.readdir(LIB_FONTS_DIR))
  } catch {
    // 目录不存在：全部失效
  }
  const out = []
  for (const f of fonts) {
    if (!fileNames.has(path.basename(f.path))) continue
    out.push({
      name: f.name,
      path: path.join(ASSETS_DIR, f.path),
      source: f.source === 'online' ? 'online' : 'library'
    })
  }
  return out
}

/** 将字体文件入库：解析族名（失败回退文件名）→ 拷贝到 fonts/ → 写 index.json */
const addFont = async (srcPath) => {
  const ext = path.extname(srcPath).toLowerCase()
  if (!FONT_EXT.includes(ext)) {
    return { error: `不支持的字体格式 ${ext || '(无扩展名)'}，仅支持 ${FONT_EXT.join(' / ')}` }
  }
  if (!fs.existsSync(srcPath)) return { error: `字体文件不存在：${srcPath}` }
  let name = await parseFontFamilyName(srcPath)
  const base = path.basename(srcPath, ext)
  if (!name) name = base
  const safeName = name.replace(/[\\/:*?"<>|]/g, '_') || base
  await fsp.mkdir(LIB_FONTS_DIR, { recursive: true })
  const target = path.join(LIB_FONTS_DIR, `${safeName}${ext}`)
  await fsp.copyFile(srcPath, target)
  return withIndexLock(async () => {
    const fonts = await readIndex()
    const item = { name, path: `fonts/${path.basename(target)}`, source: 'library', addedAt: Date.now() }
    const idx = fonts.findIndex((f) => f.name === name)
    if (idx >= 0) fonts[idx] = item
    else fonts.push(item)
    await writeIndex(fonts)
    return { name, path: target, source: 'library' }
  })
}

/** 从资源库移除字体：删 index 条目 + 删文件 */
const removeFont = async (name) => {
  return withIndexLock(async () => {
    const fonts = await readIndex()
    const idx = fonts.findIndex((f) => f.name === name)
    if (idx < 0) return { error: `资源库中不存在字体「${name}」` }
    const [removed] = fonts.splice(idx, 1)
    await writeIndex(fonts)
    try {
      const full = path.join(ASSETS_DIR, removed.path)
      if (fs.existsSync(full)) await fsp.rm(full)
    } catch {
      // 文件删除失败不影响索引
    }
    return { removed: true, name }
  })
}

// ── 对外输出 ────────────────────────────────────────────────

module.exports = {
  /** 合并系统字体 + 资源库字体，统一 { name, path, source }；资源库同名覆盖系统 */
  async listFonts() {
    const [system, library] = await Promise.all([listSystemFonts(), listLibrary()])
    const merged = new Map()
    for (const f of system) merged.set(f.name, { name: f.name, path: f.path, source: 'system' })
    for (const f of library) merged.set(f.name, f)
    return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh'))
  },

  listSystemFonts,
  listLibrary,
  addFont,
  removeFont,
  parseFontFamilyName,

  /** 读取字体文件二进制，供渲染进程 new FontFace(name, buffer) */
  async readFont(filePath) {
    const buf = await fsp.readFile(filePath)
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  },

  /** 资源库目录（供资源管理页展示路径） */
  getAssetsDir: () => ASSETS_DIR,
  getFontCachePath: () => FONT_CACHE_PATH
}
