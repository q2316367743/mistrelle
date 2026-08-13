/**
 * PPT 渲染桥（preload）：PptJsonDoc → SVG / PPTX / PNG 全部在主进程完成
 * （主进程负责 json → POM XML 转换并调用 POM 库；POM 为 ESM-only，CJS preload 无法直接 require）。
 * 导出（PPTX / PNG）由主进程构建并直接落盘，渲染进程只传 (json, 目标路径)。
 */
import { ipcRenderer } from 'electron'
import {
  PptChannels,
  PptExportPngOptions,
  PptExportPptxOptions,
  PptJsonDoc,
  PptRenderOptions
} from '~/channels'

export const pptApi = {
  /** PptJsonDoc → 每页 SVG 字符串数组（预览渲染） */
  renderPptxToSvgs: (json: PptJsonDoc, options: PptRenderOptions): Promise<string[]> =>
    ipcRenderer.invoke(PptChannels.renderPptxToSvgs, json, options),
  /** PptJsonDoc → 构建 PPTX 并落盘，返回文件路径 */
  exportPptx: (json: PptJsonDoc, options: PptExportPptxOptions): Promise<string> =>
    ipcRenderer.invoke(PptChannels.exportPptx, json, options),
  /** PptJsonDoc → 渲染指定页 PNG 并落盘，返回文件路径列表 */
  exportPptxToPngs: (json: PptJsonDoc, options: PptExportPngOptions): Promise<string[]> =>
    ipcRenderer.invoke(PptChannels.exportPptxToPngs, json, options)
}
