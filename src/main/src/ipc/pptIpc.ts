/**
 * ppt IPC handler（main 进程）：POM XML → SVG / PPTX / PNG。
 * 渲染逻辑全部在 main 进程（POM 为 ESM-only + resvg wasm Node-only 加载）；
 * 导出（PPTX / PNG）由 main 构建后**直接落盘**，渲染进程只负责传 (xml, 目标路径)。
 */
import { ipcMain } from 'electron'
import { PptChannels, PptExportPngOptions, PptExportPptxOptions, PptRenderOptions } from '~/channels'
import { exportPptxFile, exportPptxPngFiles, renderPptxToSvgs } from '../ppt/pptRenderer'

export function registerPptIpc(): void {
  ipcMain.handle(
    PptChannels.renderPptxToSvgs,
    (_event, xml: string, options: PptRenderOptions): Promise<string[]> =>
      renderPptxToSvgs(xml, options)
  )

  ipcMain.handle(
    PptChannels.exportPptx,
    (_event, xml: string, options: PptExportPptxOptions): Promise<string> =>
      exportPptxFile(xml, options, options.path)
  )

  ipcMain.handle(
    PptChannels.exportPptxToPngs,
    (_event, xml: string, options: PptExportPngOptions): Promise<string[]> =>
      exportPptxPngFiles(xml, options, options.path, options.slides)
  )
}
