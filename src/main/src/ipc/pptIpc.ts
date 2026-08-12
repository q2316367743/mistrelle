/**
 * ppt IPC handler（main 进程）：POM XML → SVG / PPTX / PNG 渲染。
 * 渲染逻辑全部在 main 进程（POM 为 ESM-only + resvg wasm Node-only 加载），
 * 渲染进程只负责显示 SVG。
 */
import { ipcMain } from 'electron'
import { PptChannels, PptRenderOptions, PptRenderPngOptions } from '~/channels'
import { buildPptxBytes, renderPptxToPngs, renderPptxToSvgs } from '../ppt/pptRenderer'

export function registerPptIpc(): void {
  ipcMain.handle(
    PptChannels.renderPptxToSvgs,
    (_event, xml: string, options: PptRenderOptions): Promise<string[]> =>
      renderPptxToSvgs(xml, options)
  )

  ipcMain.handle(
    PptChannels.buildPptxBytes,
    (_event, xml: string, options: PptRenderOptions): Promise<ArrayBuffer> =>
      buildPptxBytes(xml, options)
  )

  ipcMain.handle(
    PptChannels.renderPptxToPngs,
    (_event, xml: string, options: PptRenderPngOptions) => renderPptxToPngs(xml, options, options.slides)
  )
}
