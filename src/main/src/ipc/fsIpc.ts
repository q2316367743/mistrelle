/**
 * fs IPC handler（main 进程）：原 src-utools/src/fs.js 全部方法的 IPC 化。
 * 除 existsSync 变为异步外（renderer 调用点已 await 化），其余方法签名不变。
 */
import { ipcMain } from 'electron'
import { statSync, existsSync, createReadStream, type Dirent } from 'node:fs'
import { readdir, readFile, writeFile, mkdir, rm, copyFile, rename, stat } from 'node:fs/promises'
import readline from 'node:readline'
import { basename, join, relative, sep } from 'node:path'
import {
  FsChannels,
  type FsGlobOptions,
  type FsGlobResult,
  type FsGrepMatch,
  type FsGrepOptions,
  type FsGrepResult
} from '~/ipc/channels'

interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  isFile: boolean
  size: number
  mtime: number
  ctime: number
  atime: number
  birthtime: number
}

/** stat 结果（与原 fs.js stat 一致：无 name 字段） */
interface FileStat {
  path: string
  isDirectory: boolean
  isFile: boolean
  size: number
  mtime: number
  ctime: number
  atime: number
  birthtime: number
}

/** readFileLines 结果：窗口内行原文（不带行号）；totalLines 仅扫到 EOF 时精确，提前停流为 null */
interface FsReadLinesResult {
  lines: string[]
  totalLines: number | null
  hasMore: boolean
}

const toEntry = (path: string, name: string): FileEntry => {
  const s = statSync(join(path, name))
  return {
    name,
    path: join(path, name),
    isDirectory: s.isDirectory(),
    isFile: s.isFile(),
    size: s.size,
    mtime: s.mtimeMs,
    ctime: s.ctimeMs,
    atime: s.atimeMs,
    birthtime: s.birthtimeMs
  }
}

// ── 文件搜索（file_glob / file_grep）───────────────────────

/** 递归遍历时跳过的目录（体积大且几乎不含用户想要的结果） */
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'out',
  'build',
  '.next',
  '.cache',
  'coverage',
  '.venv',
  '__pycache__'
])
/** 最大递归深度，防止从磁盘根目录起扫描失控 */
const MAX_DEPTH = 15
/** glob / grep 结果上限，超出即停止扫描并标记 truncated */
const MAX_GLOB_FILES = 200
const MAX_GREP_MATCHES = 100
/** grep 跳过的超大文件（字节） */
const MAX_GREP_FILE_SIZE = 2 * 1024 * 1024
/** grep 匹配行文本截断长度 */
const MAX_LINE_LENGTH = 200
/** readFileLines 行收集字节预算：为 128KB 工具结果全局截断留安全余量 */
const MAX_LINES_BUDGET = 110 * 1024

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** glob 模式转正则：** 任意层级（含零层）、* 单层通配、? 单字符、{a,b} 多选、[...] / [!...] 字符类 */
function globToRegex(pattern: string): RegExp {
  let re = ''
  for (let i = 0; i < pattern.length; ) {
    const c = pattern[i]
    if (c === '*') {
      if (pattern.startsWith('**/', i)) {
        re += '(?:[^/]+/)*'
        i += 3
      } else if (pattern.startsWith('**', i)) {
        re += '.*'
        i += 2
      } else {
        re += '[^/]*'
        i += 1
      }
    } else if (c === '?') {
      re += '[^/]'
      i += 1
    } else if (c === '{') {
      const end = pattern.indexOf('}', i)
      if (end > i) {
        re += `(?:${pattern
          .slice(i + 1, end)
          .split(',')
          .map(escapeRegex)
          .join('|')})`
        i = end + 1
      } else {
        re += '\\{'
        i += 1
      }
    } else if (c === '[') {
      const end = pattern.indexOf(']', i + 1)
      if (end > i) {
        // 字符类语法整体透传，仅把 glob 的取反前缀 ! 换成正则的 ^
        const cls = pattern.slice(i, end + 1)
        re += cls.startsWith('[!') ? `[^${cls.slice(2)}` : cls
        i = end + 1
      } else {
        re += '\\['
        i += 1
      }
    } else {
      re += escapeRegex(c)
      i += 1
    }
  }
  return new RegExp(`^${re}$`)
}

/**
 * DFS 遍历 root 下所有文件（yield 绝对路径）。
 * 跳过 IGNORED_DIRS；符号链接目录不触发 Dirent.isDirectory，天然防环。
 */
async function* walkFiles(root: string): AsyncGenerator<string> {
  const stack: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }]
  while (stack.length) {
    const { dir, depth } = stack.pop() as { dir: string; depth: number }
    let entries: Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      continue // 无权限等：跳过该目录
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name) && depth < MAX_DEPTH) {
          stack.push({ dir: full, depth: depth + 1 })
        }
      } else if (entry.isFile()) {
        yield full
      }
    }
  }
}

/** root 下文件的相对路径（/ 分隔），供 glob 匹配 */
const toRelative = (root: string, file: string): string => relative(root, file).split(sep).join('/')

export function registerFsIpc(): void {
  ipcMain.handle(FsChannels.readDir, async (_event, path: string): Promise<FileEntry[]> => {
    const names = await readdir(path)
    return names.map((name) => toEntry(path, name))
  })

  ipcMain.handle(FsChannels.writeTextFile, (_event, path: string, text: string): Promise<void> =>
    writeFile(path, text, 'utf-8')
  )

  ipcMain.handle(FsChannels.readTextFile, (_event, path: string): Promise<string> =>
    readFile(path, 'utf-8')
  )

  ipcMain.handle(
    FsChannels.readFileLines,
    async (_event, path: string, offset = 1, limit = 500): Promise<FsReadLinesResult> => {
      if (!existsSync(path)) throw new Error(`文件不存在：${path}`)
      const lines: string[] = []
      let seen = 0 // 已流经的行数（含 offset 之前的）
      let budget = MAX_LINES_BUDGET
      let stoppedEarly = false
      const rl = readline.createInterface({
        input: createReadStream(path, { encoding: 'utf-8' }),
        crlfDelay: Infinity
      })
      for await (const line of rl) {
        seen++
        if (lines.length >= limit) {
          stoppedEarly = true // 窗口满后再见一行，即确认还有剩余
          break
        }
        if (seen < offset) continue
        const byteLen = Buffer.byteLength(line)
        if (byteLen > budget) {
          // 预算耗尽：一行未收时截断本行保进度（单行超长场景），已有收行则直接停
          if (lines.length === 0) {
            lines.push(`${line.slice(0, budget)}[本行共 ${byteLen} 字节，超出读取预算已截断]`)
          }
          stoppedEarly = true
          break
        }
        lines.push(line)
        budget -= byteLen
      }
      return { lines, totalLines: stoppedEarly ? null : seen, hasMore: stoppedEarly }
    }
  )

  ipcMain.handle(FsChannels.readBinaryFile, async (_event, path: string): Promise<ArrayBuffer> => {
    const buffer = await readFile(path)
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
  })

  ipcMain.handle(FsChannels.existsSync, (_event, path: string): boolean => existsSync(path))

  ipcMain.handle(FsChannels.mkdir, (_event, path: string, recursive = true): Promise<string | undefined> =>
    mkdir(path, { recursive })
  )

  ipcMain.handle(FsChannels.rm, (_event, path: string, options = { recursive: true, force: true }): Promise<void> =>
    rm(path, options)
  )

  ipcMain.handle(FsChannels.copyFile, (_event, src: string, dest: string): Promise<void> =>
    copyFile(src, dest)
  )

  ipcMain.handle(FsChannels.rename, (_event, src: string, dest: string): Promise<void> =>
    rename(src, dest)
  )

  ipcMain.handle(
    FsChannels.writeBinaryFile,
    (_event, path: string, arrayBuffer: ArrayBuffer): Promise<void> =>
      writeFile(path, Buffer.from(arrayBuffer))
  )

  ipcMain.handle(FsChannels.stat, async (_event, path: string): Promise<FileStat> => {
    const s = await stat(path)
    return {
      path,
      isDirectory: s.isDirectory(),
      isFile: s.isFile(),
      size: s.size,
      mtime: s.mtimeMs,
      ctime: s.ctimeMs,
      atime: s.atimeMs,
      birthtime: s.birthtimeMs
    }
  })

  ipcMain.handle(FsChannels.glob, async (_event, opts: FsGlobOptions): Promise<FsGlobResult> => {
    const re = globToRegex(opts.pattern.split('\\').join('/'))
    const files: string[] = []
    for await (const file of walkFiles(opts.path)) {
      if (!re.test(toRelative(opts.path, file))) continue
      if (files.length >= MAX_GLOB_FILES) return { files, truncated: true }
      files.push(file)
    }
    return { files, truncated: false }
  })

  ipcMain.handle(FsChannels.grep, async (_event, opts: FsGrepOptions): Promise<FsGrepResult> => {
    const flags = opts.ignoreCase ? 'i' : ''
    let re: RegExp
    try {
      re = new RegExp(opts.pattern, flags)
    } catch {
      // 非法正则降级为字面量匹配，避免整个搜索直接失败
      re = new RegExp(escapeRegex(opts.pattern), flags)
    }
    const includeHasSlash = opts.include?.includes('/') ?? false
    const includeRe = opts.include ? globToRegex(opts.include.split('\\').join('/')) : null
    const matches: FsGrepMatch[] = []
    for await (const file of walkFiles(opts.path)) {
      if (matches.length >= MAX_GREP_MATCHES) return { matches, truncated: true }
      if (includeRe) {
        const target = includeHasSlash ? toRelative(opts.path, file) : basename(file)
        if (!includeRe.test(target)) continue
      }
      let content: string
      try {
        if (statSync(file).size > MAX_GREP_FILE_SIZE) continue
        content = await readFile(file, 'utf-8')
      } catch {
        continue // 读取失败（权限 / 编码）：跳过该文件
      }
      // UTF-8 解码后含 NUL 视为二进制文件，跳过
      if (content.slice(0, 8192).includes('\0')) continue
      const lines = content.split('\n')
      for (let i = 0; i < lines.length && matches.length < MAX_GREP_MATCHES; i++) {
        if (!re.test(lines[i])) continue
        matches.push({ file, line: i + 1, text: lines[i].trim().slice(0, MAX_LINE_LENGTH) })
      }
    }
    return { matches, truncated: false }
  })
}
