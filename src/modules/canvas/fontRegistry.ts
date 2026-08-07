/**
 * 渲染层字体注册器：为画布预览 / 导出提供「字体就绪」保证。
 *
 * 策略（统一入口 + 内部自适应）：
 * - system 来源：Chromium 原生可用，直接跳过（最精确、零加载）。
 * - library / online 来源：读字体文件二进制 → new FontFace(name, buffer) → document.fonts.add。
 *   只懒加载画布实际用到的字体族（设计一般 2~3 个家族），重复渲染命中已注册集合不重复加载。
 *
 * 调用方：exportCanvasPng / CanvasRenderer 渲染前 await ensureFontsForDoc(doc)。
 */
import type { CanvasDoc, CanvasNode } from './canvasTypes'

/** 已注册字体族集合（去重，避免重复 FontFace） */
const registeredFamilies = new Set<string>()

/** 渲染进程 document.fonts 可用性降级开关（不可用时静默跳过 FontFace，不影响预览） */
const supportsFontFace = typeof document !== 'undefined' && 'fonts' in document

/** TS lib.dom 未为 FontFaceSet 建模 add()，运行时存在，窄断言补全（lib 缺陷导致的必要 as） */
const fontSetAdd = (face: FontFace): void => {
  const set = document.fonts as FontFaceSet & { add(font: FontFace): unknown }
  set.add(face)
}

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

/** 注册单个字体族（仅 library / online 来源；system 走 Chromium 原生） */
const registerFontFace = async (family: string, fontPath: string): Promise<void> => {
  if (registeredFamilies.has(family) || !supportsFontFace) return
  try {
    const buffer = await window.preload.font.readFont(fontPath)
    const face = new FontFace(family, buffer)
    await face.load()
    fontSetAdd(face)
    registeredFamilies.add(family)
  } catch {
    // 字体损坏 / 加载失败：静默降级为默认字体，不阻塞画布渲染导出
  }
}

/**
 * 确保画布用到的全部字体已就绪。
 * 内部调用 font.listFonts() 建立 name → {source, path} 映射（渲染层独立获取，
 * 不依赖模型先调用 font_list），仅对非 system 来源走 FontFace 注册。
 */
export const ensureFontsForDoc = async (doc: CanvasDoc | null | undefined): Promise<void> => {
  const families = collectFontFamilies(doc)
  if (!families.length || !supportsFontFace) return
  try {
    const all = await window.preload.font.listFonts()
    const byName = new Map(all.map((f) => [f.name, f]))
    const pending = families
      .map((family) => byName.get(family))
      .filter((f): f is NonNullable<typeof f> => !!f && f.source !== 'system' && !registeredFamilies.has(f.name))
    await Promise.all(pending.map((f) => registerFontFace(f.name, f.path)))
  } catch {
    // 字体清单获取失败：静默降级，不阻塞渲染导出
  }
}
