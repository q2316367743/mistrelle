/**
 * fs IPC handler（main 进程）：原 src-utools/src/fs.js 全部方法的 IPC 化。
 * 除 existsSync 变为异步外（renderer 调用点已 await 化），其余方法签名不变。
 */
import { ipcMain } from 'electron'
import { statSync, existsSync } from 'node:fs'
import { readdir, readFile, writeFile, mkdir, rm, copyFile, rename, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { FsChannels } from '~/channels'

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
}
