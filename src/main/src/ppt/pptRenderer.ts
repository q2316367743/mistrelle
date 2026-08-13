/**
 * PPT 渲染核心（主进程）：PptJsonDoc → 每页 SVG / 导出 PPTX / PNG。
 *
 * 渲染进程全程 JSON（SlideNode），主进程在导出 / 渲染前经 jsonToPomXml 转为 POM XML；
 * POM 为 ESM-only（exports 无 require 条件），CJS 主进程只能动态 import() 加载；
 * 首次调用后缓存 promise，避免反复解析。POC 已验证该链路（含 Icon / Chart / 中文）。
 * 导出（PPTX / PNG）在**主进程内构建并直接落盘**，渲染进程只传 (json, 目标路径)，
 * 不经手字节数组（避免主进程 → 渲染进程 → 主进程的往返）。
 */
import type { Diagnostic } from '@hirokisakabe/pom'
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { PptJsonDoc } from '~/channels'
import { jsonToPomXml } from './jsonToPomXml'

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
 * 渲染 PptJsonDoc 为每页 SVG 字符串数组（预览链路）：
 * jsonToPomXml → buildPptx(xml) → PPTX 字节 → convertPptxToSvg → svgs
 */
export const renderPptxToSvgs = async (json: PptJsonDoc, size: { w: number; h: number }): Promise<string[]> => {
  const { buildPptx } = await loadPom()
  const { convertPptxToSvg } = await loadGlimpse()
  const { pptx, diagnostics } = await buildPptx(jsonToPomXml(json), size)
  const errorText = collectErrorText(diagnostics)
  const buf = await pptx.write({ outputType: 'nodebuffer' })
  const report = await convertPptxToSvg(buf)
  const svgs = report.slides.map((s) => s.svg)
  if (errorText) console.warn('[ppt] 渲染诊断提示：', errorText)
  return svgs
}

/** 渲染指定页（1 起始，缺省全部）为 PNG 并落盘（导出 PNG 用）：
 *  - 单页（slides 长度 1）：targetPath 为文件路径
 *  - 多页：targetPath 为目录，每页写 page-{n}.png
 * 返回已写入的文件路径列表。 */
export const exportPptxPngFiles = async (
  json: PptJsonDoc,
  size: { w: number; h: number },
  targetPath: string,
  slides?: number[]
): Promise<string[]> => {
  const { buildPptx } = await loadPom()
  const { convertPptxToPng } = await loadGlimpse()
  const { pptx } = await buildPptx(jsonToPomXml(json), size)
  const buf = await pptx.write({ outputType: 'nodebuffer' })
  const report = await convertPptxToPng(buf, { width: size.w, slides })
  const files: string[] = []
  for (const s of report.slides) {
    const file = slides != null && slides.length === 1 ? targetPath : join(targetPath, `page-${s.slideNumber}.png`)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, s.png)
    files.push(file)
  }
  return files
}

/** 构建 PPTX 并落盘（导出 PPTX 用），返回文件路径 */
export const exportPptxFile = async (
  json: PptJsonDoc,
  size: { w: number; h: number },
  filePath: string
): Promise<string> => {
  const { buildPptx } = await loadPom()
  const { pptx, diagnostics } = await buildPptx(jsonToPomXml(json), size)
  const errorText = collectErrorText(diagnostics)
  const buf = await pptx.write({ outputType: 'nodebuffer' })
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, buf)
  if (errorText) console.warn('[ppt] 构建诊断提示：', errorText)
  return filePath
}
