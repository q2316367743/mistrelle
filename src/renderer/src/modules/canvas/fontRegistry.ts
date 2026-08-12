/**
 * 渲染层字体注册器：为画布预览 / 导出提供「字体就绪」保证。
 *
 * 策略（统一入口 + 内部自适应）：
 * - system 来源：Chromium 原生可用，直接跳过（最精确、零加载）。
 * - library / online 来源：委托给共享注册器 createFontFaceRegistry（FontFace URL 源 + pathToHref 异步加载，
 *   上限 50 超限 LRU 淘汰），不经 IPC 读整包字节进渲染进程。
 *   只懒加载画布实际用到的字体族（设计一般 2~3 个家族），重复渲染命中已注册集合不重复加载。
 *
 * 调用方：exportCanvasPng / CanvasRenderer 渲染前 await ensureFontsForDoc(doc)。
 */
import type { CanvasDoc, CanvasNode } from './canvasTypes'
import { createFontFaceRegistry } from '@/utils/fontFaceRegistry'

/** 画布字体同时驻留 document.fonts 的上限 */
const MAX_REGISTERED_FACES = 50

const registry = createFontFaceRegistry(MAX_REGISTERED_FACES)

/** 递归收集画布中全部 text 节点用到的 fontFamily（去重） */
export const collectFontFamilies = (doc: CanvasDoc | null | undefined): string[] => {
  if (!doc) return []
  const families = new Set<string>()
  const walk = (nodes: CanvasNode[] | undefined): void => {
    if (!Array.isArray(nodes)) return
    for (const node of nodes) {
      if (node.type === 'text' && typeof node.fontFamily === 'string' && node.fontFamily) {
        families.add(node.fontFamily)
      }
      walk(node.children)
    }
  }
  walk(doc.nodes)
  return [...families]
}

/**
 * 确保画布用到的全部字体已就绪。
 * 内部调用 font.listFonts() 建立 name → {source, path} 映射（渲染层独立获取，
 * 不依赖模型先调用 font_list），仅对非 system 来源走 FontFace 注册（ensure 幂等，命中刷新 lastUsed）。
 */
export const ensureFontsForDoc = async (doc: CanvasDoc | null | undefined): Promise<void> => {
  const families = collectFontFamilies(doc)
  if (!families.length) return
  try {
    const all = await window.preload.font.listFonts()
    const byName = new Map(all.map((f) => [f.name, f]))
    const pending = families
      .map((family) => byName.get(family))
      .filter((f): f is NonNullable<typeof f> => !!f && f.source !== 'system')
    await Promise.all(pending.map((f) => registry.ensure(f)))
  } catch {
    // 字体清单获取失败：静默降级，不阻塞渲染导出
  }
}
