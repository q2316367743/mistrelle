/**
 * PPT 渲染核心（主进程）：POM XML → PPTX 字节 → 每页 SVG / PNG。
 *
 * POM 为 ESM-only（exports 无 require 条件），CJS 主进程只能动态 import() 加载；
 * 首次调用后缓存 promise，避免反复解析。POC 已验证该链路（含 Icon / Chart / 中文）。
 */
import type { Diagnostic } from '@hirokisakabe/pom'

let pomModule: Promise<typeof import('@hirokisakabe/pom')> | null = null
const loadPom = (): Promise<typeof import('@hirokisakabe/pom')> =>
  (pomModule ??= import('@hirokisakabe/pom'))

let glimpseModule: Promise<typeof import('pptx-glimpse')> | null = null
const loadGlimpse = (): Promise<typeof import('pptx-glimpse')> =>
  (glimpseModule ??= import('pptx-glimpse'))

/** 默认画布尺寸：16:9（与 ppt_guidelines 一致，渲染 / 导出共用） */
export const PPT_SLIDE_SIZE = { w: 1280, h: 720 } as const

/** buildPptx 返回的错误级诊断文本；仅提示类诊断返回 null（不阻塞渲染） */
const collectErrorText = (diagnostics: Diagnostic[]): string | null => {
  if (!diagnostics.length) return null
  return diagnostics.map((d) => d.message).join('；')
}

/**
 * 渲染 POM XML 为每页 SVG 字符串数组（预览链路）：
 * buildPptx(xml) → PPTX 字节 → convertPptxToSvg → svgs
 */
export const renderPptxToSvgs = async (xml: string, size: { w: number; h: number }): Promise<string[]> => {
  const { buildPptx } = await loadPom()
  const { convertPptxToSvg } = await loadGlimpse()
  const { pptx, diagnostics } = await buildPptx(xml, size)
  const errorText = collectErrorText(diagnostics)
  const buf = await pptx.write({ outputType: 'nodebuffer' })
  const report = await convertPptxToSvg(buf)
  const svgs = report.slides.map((s) => s.svg)
  if (errorText) console.warn('[ppt] 渲染诊断提示：', errorText)
  return svgs
}

/** 构建 PPTX 字节（导出 PPTX 用，返回 ArrayBuffer 走 IPC） */
export const buildPptxBytes = async (xml: string, size: { w: number; h: number }): Promise<ArrayBuffer> => {
  const { buildPptx } = await loadPom()
  const { pptx, diagnostics } = await buildPptx(xml, size)
  const errorText = collectErrorText(diagnostics)
  const buf = await pptx.write({ outputType: 'arraybuffer' })
  if (errorText) console.warn('[ppt] 构建诊断提示：', errorText)
  return buf
}

/**
 * 渲染指定页（1 起始，缺省全部）为 PNG 字节（导出 PNG 用）。
 * 返回按页码升序的 { page, bytes } 列表。
 */
export const renderPptxToPngs = async (
  xml: string,
  size: { w: number; h: number },
  slides?: number[]
): Promise<{ page: number; bytes: ArrayBuffer }[]> => {
  const { buildPptx } = await loadPom()
  const { convertPptxToPng } = await loadGlimpse()
  const { pptx } = await buildPptx(xml, size)
  const buf = await pptx.write({ outputType: 'nodebuffer' })
  const report = await convertPptxToPng(buf, { width: size.w, slides })
  return report.slides.map((s) => ({
    page: s.slideNumber,
    bytes: s.png.buffer.slice(s.png.byteOffset, s.png.byteOffset + s.png.byteLength) as ArrayBuffer
  }))
}
