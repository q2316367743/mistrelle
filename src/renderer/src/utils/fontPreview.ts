/**
 * 字体预览加载器：为字体预览 UI（资源管理页 / 聊天选字面板）注册非 system 字体的 FontFace。
 * - system 字体：Chromium 原生可用，CSS font-family 直接渲染，无需加载。
 * - library / online 字体：委托给共享注册器 createFontFaceRegistry（FontFace URL 源 + pathToHref 异步加载，
 *   上限 60 超限 LRU 淘汰），字节由浏览器管理、不经 IPC 读整包进渲染进程。
 * 缓存 key 含 source+name；删除后重新入库同名字体需 clearFontPreviewCache 刷新。
 */
import { createFontFaceRegistry } from '@/utils/fontFaceRegistry'
import { FontItem } from '@/domain/FontItem'

/** 预览字体同时驻留 document.fonts 的上限 */
const MAX_PREVIEW_FACES = 60

const registry = createFontFaceRegistry(MAX_PREVIEW_FACES)

/** 确保字体可预览：返回后 CSS font-family 即可命中该字体（加载失败静默降级，不阻塞页面） */
export const ensureFontPreview = (font: Pick<FontItem, 'name' | 'path' | 'source'>): Promise<void> =>
  registry.ensure(font)

/** 清空预览加载缓存（字体文件被替换 / 重新入库时调用）：同时从 document.fonts 释放全部预览字体 */
export const clearFontPreviewCache = (): void => {
  registry.clear()
}
