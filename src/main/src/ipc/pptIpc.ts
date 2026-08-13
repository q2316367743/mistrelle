/**
 * ppt IPC handler（main 进程）：PptJsonDoc → SVG / PPTX / PNG。
 * 渲染 / 导出全部在 main 进程（json → POM XML 转换 + POM 构建；POM 为 ESM-only
 * + resvg wasm Node-only 加载）；导出（PPTX / PNG）由 main 构建后**直接落盘**，
 * 渲染进程只负责传 (json, 目标路径)。
 */
import { ipcMain } from 'electron'
import {
  PptChannels,
  PptExportPngOptions,
  PptExportPptxOptions,
  PptJsonDoc,
  PptRenderOptions
} from '~/channels'
import { exportPptxFile, exportPptxPngFiles, renderPptxToSvgs } from '../ppt/pptRenderer'

export function registerPptIpc(): void {
  ipcMain.handle(
    PptChannels.renderPptxToSvgs,
    (_event, json: PptJsonDoc, options: PptRenderOptions): Promise<string[]> =>
      renderPptxToSvgs(json, options)
  )

  ipcMain.handle(
    PptChannels.exportPptx,
    (_event, json: PptJsonDoc, options: PptExportPptxOptions): Promise<string> =>
      exportPptxFile(json, options, options.path)
  )

  ipcMain.handle(
    PptChannels.exportPptxToPngs,
    (_event, json: PptJsonDoc, options: PptExportPngOptions): Promise<string[]> =>
      exportPptxPngFiles(json, options, options.path, options.slides)
  )
}
