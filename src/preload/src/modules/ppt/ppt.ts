/**
 * PPT 导出桥（preload）：预览由渲染进程 vueRender 直接渲染，不经 IPC。
 * 导出：PPTX 载荷为 DOM 实测快照（主进程 PptxGenJS 构建落盘）；PNG 由渲染进程
 * canvas 绘制为 dataURL 后主进程仅落盘。渲染进程不经手 PPTX 字节。
 */
import { ipcRenderer } from 'electron'
import {
  PptChannels,
  PptExportPptxOptions,
  PptExportSnapshot,
  PptWritePngFilesOptions
} from './pptChannels'

export const pptApi = {
  /** 快照 → 构建 PPTX 并落盘，返回文件路径 */
  exportPptx: (snapshot: PptExportSnapshot, options: PptExportPptxOptions): Promise<string> =>
    ipcRenderer.invoke(PptChannels.exportPptx, snapshot, options),
  /** PNG dataURL 列表落盘，返回文件路径列表 */
  writePngFiles: (
    images: string[],
    options: PptWritePngFilesOptions
  ): Promise<string[]> => ipcRenderer.invoke(PptChannels.writePngFiles, images, options)
}
