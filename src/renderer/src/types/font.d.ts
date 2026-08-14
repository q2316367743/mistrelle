/**
 * 字体相关类型（window.preload.font）。
 *
 * 统一字体项契约：系统字体 / 资源库字体都以 { name, path, source } 输出，
 * source 预留 'online'（在线字体未来下载到资源库 fonts/ 并标记，此版不实现）。
 * 渲染统一入口：system → Chromium 原生；library / online → 渲染进程 new FontFace。
 */
import type { FontItem, FontMeta } from '@/domain/FontItem'

declare interface FontApi {
  /** 合并系统字体 + 资源库字体，统一 { name, path, source }；资源库同名覆盖系统 */
  listFonts: () => Promise<FontItem[]>
  /** 系统字体列表（读缓存立即返回 + 后台刷新） */
  listSystemFonts: () => Promise<Array<Omit<FontItem, 'source'>>>
  /** 资源库字体列表（读 index.json + 文件存在性校验，零解析） */
  listLibrary: () => Promise<FontItem[]>
  /** 将字体文件入库：解析族名（失败回退文件名）→ 拷贝到 fonts/ → 写 index.json；meta 可选一并持久化 */
  addFont: (srcPath: string, meta?: Partial<FontMeta>) => Promise<FontItem & { error?: string }>
  /** 更新字体分类元数据：资源库字体写 assets/index.json，系统字体写 font-cache.json */
  updateFontMeta: (
    name: string,
    meta?: Partial<FontMeta>
  ) => Promise<{ name?: string; meta?: Partial<FontMeta>; error?: string }>
  /** 从资源库移除字体：删 index 条目 + 删文件 */
  removeFont: (name: string) => Promise<{ removed?: boolean; name?: string; error?: string }>
  /** 解析字体文件家族名；无法解析返回 null */
  parseFontFamilyName: (filePath: string) => Promise<string | null>
  /** 读取字体文件二进制，供渲染进程 new FontFace(name, buffer) */
  readFont: (filePath: string) => Promise<ArrayBuffer>
  /** 资源库目录（供资源管理页展示路径） */
  getAssetsDir: () => string
  /** 系统字体缓存文件路径 */
  getFontCachePath: () => string
}
