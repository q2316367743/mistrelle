/**
 * font 桥（preload）：原 src-utools/src/font.js 的 IPC 化。
 * 系统字体枚举 / 资源库管理等实现迁入 main（font/index.ts + fontIpc.ts）；
 * getAssetsDir / getFontCachePath 为纯路径常量，留在 preload 同步实现。
 */
import { homedir } from 'node:os'
import { join } from 'node:path'
import { ipcRenderer } from 'electron'
import { FontChannels } from './channels'

export type FontSource = 'system' | 'library' | 'online'

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

const DATA_DIR = join(homedir(), '.mistrelle')
const ASSETS_DIR = join(DATA_DIR, 'assets')

const toArrayBuffer = (data: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(data)
  return copy.buffer
}

export const fontApi = {
  /** 合并系统字体 + 资源库字体，统一 { name, path, source }；资源库同名覆盖系统 */
  listFonts: (): Promise<FontItem[]> => ipcRenderer.invoke(FontChannels.listFonts),
  /** 系统字体列表（读缓存立即返回 + 后台刷新） */
  listSystemFonts: (): Promise<Array<Omit<FontItem, 'source'>>> =>
    ipcRenderer.invoke(FontChannels.listSystemFonts),
  /** 资源库字体列表（读 index.json + 文件存在性校验，零解析） */
  listLibrary: (): Promise<FontItem[]> => ipcRenderer.invoke(FontChannels.listLibrary),
  /** 将字体文件入库：解析族名（失败回退文件名）→ 拷贝到 fonts/ → 写 index.json */
  addFont: (srcPath: string, meta?: Partial<FontMeta>): Promise<FontItem & { error?: string }> =>
    ipcRenderer.invoke(FontChannels.addFont, srcPath, meta),
  /** 更新字体分类元数据：资源库写 assets/index.json，系统字体写 font-cache.json */
  updateFontMeta: (
    name: string,
    meta?: Partial<FontMeta>
  ): Promise<{ name?: string; meta?: Partial<FontMeta>; error?: string }> =>
    ipcRenderer.invoke(FontChannels.updateFontMeta, name, meta),
  /** 从资源库移除字体：删 index 条目 + 删文件 */
  removeFont: (name: string): Promise<{ removed?: boolean; name?: string; error?: string }> =>
    ipcRenderer.invoke(FontChannels.removeFont, name),
  /** 解析字体文件家族名；无法解析返回 null */
  parseFontFamilyName: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke(FontChannels.parseFontFamilyName, filePath),
  /** 读取字体文件二进制，供渲染进程 new FontFace(name, buffer) */
  readFont: async (filePath: string): Promise<ArrayBuffer> => {
    const data = (await ipcRenderer.invoke(FontChannels.readFont, filePath)) as Uint8Array
    return toArrayBuffer(data)
  },
  /** 资源库目录（供资源管理页展示路径） */
  getAssetsDir: (): string => ASSETS_DIR,
  /** 系统字体缓存文件路径 */
  getFontCachePath: (): string => join(DATA_DIR, 'font-cache.json')
}
