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

declare interface FsApi {
  readDir: (path: string) => Promise<Array<FileItem>>
  writeTextFile: (path: string, text: string) => Promise<void>
  readTextFile: (path: string) => Promise<string>
}
