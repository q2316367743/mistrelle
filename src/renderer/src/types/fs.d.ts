declare interface FileItem {
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

declare interface FileStat {
  path: string
  isDirectory: boolean
  isFile: boolean
  size: number
  mtime: number
  ctime: number
  atime: number
  birthtime: number
}

declare interface FsGlobOptions {
  path: string
  pattern: string
}

declare interface FsGlobResult {
  files: string[]
  truncated: boolean
}

declare interface FsGrepOptions {
  path: string
  pattern: string
  include?: string
  ignoreCase?: boolean
}

declare interface FsGrepMatch {
  file: string
  line: number
  text: string
}

declare interface FsGrepResult {
  matches: FsGrepMatch[]
  truncated: boolean
}

declare interface FsApi {
  readDir: (path: string) => Promise<Array<FileItem>>
  writeTextFile: (path: string, text: string) => Promise<void>
  readTextFile: (path: string) => Promise<string>
  readBinaryFile: (path: string) => Promise<ArrayBuffer>
  existsSync: (path: string) => boolean
  mkdir: (path: string, recursive = true) => Promise<void>
  rm: (path: string, options = { recursive: true, force: true }) => Promise<void>
  copyFile: (src: string, dest: string) => Promise<void>
  rename: (src: string, dest: string) => Promise<void>
  writeBinaryFile: (path: string, arrayBuffer: ArrayBuffer) => Promise<void>
  stat: (path: string) => Promise<FileStat>
  glob: (opts: FsGlobOptions) => Promise<FsGlobResult>
  grep: (opts: FsGrepOptions) => Promise<FsGrepResult>
}
