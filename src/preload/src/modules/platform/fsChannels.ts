/**
 * fs 域 IPC 契约：通道常量 + glob/grep 载荷与结果类型。
 * preload 桥与 main handler 共用，保持两侧契约一致。
 */
// ── fs ─────────────────────────────────────────────────────
export const FsChannels = {
  readDir: 'fs:readDir',
  writeTextFile: 'fs:writeTextFile',
  readTextFile: 'fs:readTextFile',
  readFileLines: 'fs:readFileLines',
  readBinaryFile: 'fs:readBinaryFile',
  existsSync: 'fs:existsSync',
  mkdir: 'fs:mkdir',
  rm: 'fs:rm',
  copyFile: 'fs:copyFile',
  rename: 'fs:rename',
  writeBinaryFile: 'fs:writeBinaryFile',
  stat: 'fs:stat',
  glob: 'fs:glob',
  grep: 'fs:grep'
} as const

/** file_glob 载荷：起始目录 + glob 模式 */
export interface FsGlobOptions {
  path: string
  pattern: string
}

/** file_glob 结果：匹配文件的绝对路径，超上限截断并标记 truncated */
export interface FsGlobResult {
  files: string[]
  truncated: boolean
}

/** file_grep 载荷：正则 + 可选文件名过滤 */
export interface FsGrepOptions {
  path: string
  pattern: string
  /** 文件名 glob 过滤（如 *.ts）；含 / 时按相对路径匹配 */
  include?: string
  ignoreCase?: boolean
}

/** file_grep 单条匹配：行号 1 起始 */
export interface FsGrepMatch {
  file: string
  line: number
  text: string
}

/** file_grep 结果：超上限截断并标记 truncated */
export interface FsGrepResult {
  matches: FsGrepMatch[]
  truncated: boolean
}
