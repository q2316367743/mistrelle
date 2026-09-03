/**
 * fs 桥（preload）：原 src-utools/src/fs.js 的 IPC 化。
 * 实现迁入 main（fsIpc.ts）；除 existsSync 变为异步（Promise<boolean>，renderer 调用点已 await 化）外，
 * 方法签名与返回形态与原模块一致。
 */
import { ipcRenderer } from 'electron'
import {existsSync} from 'node:fs'
import {
  FsChannels,
  type FsGlobOptions,
  type FsGlobResult,
  type FsGrepOptions,
  type FsGrepResult
} from './fsChannels'

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

/** readFileLines 结果：窗口内行原文（不带行号）；totalLines 仅扫到 EOF 时精确，提前停流为 null */
interface FsReadLinesResult {
  lines: string[]
  totalLines: number | null
  hasMore: boolean
}

const toArrayBuffer = (data: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(data)
  return copy.buffer
}

export const fsApi = {
  readDir: (path: string): Promise<FileEntry[]> => ipcRenderer.invoke(FsChannels.readDir, path),
  writeTextFile: (path: string, text: string): Promise<void> =>
    ipcRenderer.invoke(FsChannels.writeTextFile, path, text),
  readTextFile: (path: string): Promise<string> => ipcRenderer.invoke(FsChannels.readTextFile, path),
  readFileLines: (path: string, offset: number, limit: number): Promise<FsReadLinesResult> =>
    ipcRenderer.invoke(FsChannels.readFileLines, path, offset, limit),
  readBinaryFile: async (path: string): Promise<ArrayBuffer> => {
    const data = (await ipcRenderer.invoke(FsChannels.readBinaryFile, path)) as Uint8Array
    return toArrayBuffer(data)
  },
  existsSync: (path: string): boolean => existsSync(path),
  mkdir: (path: string, recursive = true): Promise<void> =>
    ipcRenderer.invoke(FsChannels.mkdir, path, recursive),
  rm: (path: string, options = { recursive: true, force: true }): Promise<void> =>
    ipcRenderer.invoke(FsChannels.rm, path, options),
  copyFile: (src: string, dest: string): Promise<void> =>
    ipcRenderer.invoke(FsChannels.copyFile, src, dest),
  rename: (src: string, dest: string): Promise<void> =>
    ipcRenderer.invoke(FsChannels.rename, src, dest),
  writeBinaryFile: (path: string, arrayBuffer: ArrayBuffer): Promise<void> =>
    ipcRenderer.invoke(FsChannels.writeBinaryFile, path, arrayBuffer),
  stat: (path: string): Promise<FileEntry> => ipcRenderer.invoke(FsChannels.stat, path),
  glob: (opts: FsGlobOptions): Promise<FsGlobResult> => ipcRenderer.invoke(FsChannels.glob, opts),
  grep: (opts: FsGrepOptions): Promise<FsGrepResult> => ipcRenderer.invoke(FsChannels.grep, opts)
}
