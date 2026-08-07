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
}
