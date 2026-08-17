/**
 * ppt IPC handler（main 进程）：
 * - PPTX：PptExportSnapshot（渲染进程 DOM 实测快照）→ PptxGenJS 按绝对坐标构建落盘
 * - PNG：渲染进程 canvas 绘制的 dataURL 列表 → 解码落盘（主进程不做渲染）
 */
import { ipcMain } from 'electron'
import {
  PptChannels,
  PptExportPptxOptions,
  PptExportSnapshot,
  PptWritePngFilesOptions
} from '~/channels'
import { exportSnapshotToPptx } from '../ppt/pptxExport'
import { writePngFiles } from '../ppt/pngWriter'

export function registerPptIpc(): void {
  ipcMain.handle(
    PptChannels.exportPptx,
    (_event, snapshot: PptExportSnapshot, options: PptExportPptxOptions): Promise<string> =>
      exportSnapshotToPptx(snapshot, options.path)
  )

  ipcMain.handle(
    PptChannels.writePngFiles,
    (_event, images: string[], options: PptWritePngFilesOptions): Promise<string[]> =>
      writePngFiles(images, options.targetPath, options.pages)
  )
}
