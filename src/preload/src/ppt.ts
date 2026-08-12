/**
 * PPT 渲染桥（preload）：POM XML → SVG / PPTX / PNG 全部在主进程完成，
 * 渲染进程经此桥调用（POM 为 ESM-only，CJS preload 无法直接 require）。
 * 导出（PPTX / PNG）由主进程构建并直接落盘，渲染进程只传 (xml, 目标路径)。
 */
import { ipcRenderer } from 'electron'
import { PptChannels, PptExportPngOptions, PptExportPptxOptions, PptRenderOptions } from '~/channels'

export const pptApi = {
  /** POM XML → 每页 SVG 字符串数组（预览渲染） */
  renderPptxToSvgs: (xml: string, options: PptRenderOptions): Promise<string[]> =>
    ipcRenderer.invoke(PptChannels.renderPptxToSvgs, xml, options),
  /** POM XML → 构建 PPTX 并落盘，返回文件路径 */
  exportPptx: (xml: string, options: PptExportPptxOptions): Promise<string> =>
    ipcRenderer.invoke(PptChannels.exportPptx, xml, options),
  /** POM XML → 渲染指定页 PNG 并落盘，返回文件路径列表 */
  exportPptxToPngs: (xml: string, options: PptExportPngOptions): Promise<string[]> =>
    ipcRenderer.invoke(PptChannels.exportPptxToPngs, xml, options)
}
