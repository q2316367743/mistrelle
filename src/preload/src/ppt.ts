/**
 * PPT 渲染桥（preload）：POM XML → SVG / PPTX / PNG 全部在主进程完成，
 * 渲染进程经此桥调用（POM 为 ESM-only，CJS preload 无法直接 require）。
 */
import { ipcRenderer } from 'electron'
import { PptChannels, PptRenderOptions, PptRenderPngOptions, PptPngResult } from '~/channels'

export const pptApi = {
  /** POM XML → 每页 SVG 字符串数组（预览渲染） */
  renderPptxToSvgs: (xml: string, options: PptRenderOptions): Promise<string[]> =>
    ipcRenderer.invoke(PptChannels.renderPptxToSvgs, xml, options),
  /** POM XML → PPTX 字节（导出 PPTX） */
  buildPptxBytes: (xml: string, options: PptRenderOptions): Promise<ArrayBuffer> =>
    ipcRenderer.invoke(PptChannels.buildPptxBytes, xml, options),
  /** POM XML → 指定页 PNG 字节（导出 PNG，缺省全部页） */
  renderPptxToPngs: (xml: string, options: PptRenderPngOptions): Promise<PptPngResult[]> =>
    ipcRenderer.invoke(PptChannels.renderPptxToPngs, xml, options)
}
