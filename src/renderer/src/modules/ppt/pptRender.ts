/**
 * PPT 导出与几何检查封装（渲染进程侧）：
 * - PPTX：离屏快照 → IPC → 主进程 PptxGenJS 按绝对坐标构建落盘
 * - PNG：同一份快照经 canvas 绘制器位图化 → IPC → 主进程仅落盘
 * - 几何检查：离屏挂载单页实测各节点包围盒（ppt_inspect 用，与导出同源渲染层）
 * 快照是预览与导出的同源契约：导出内容即预览所见（布局真相在渲染进程 CSS）。
 */
import type { PptJsonDoc } from './pptTypes'
import { PPT_SLIDE_SIZE } from './pptTypes'
import { snapshotDoc, measureSlideBounds, type PptNodeBounds } from './vueRender/offscreen'
import { paintSlideToPng } from './vueRender/pngPaint'

/** 清理 Electron invoke 错误的包装前缀，保留原始错误文本 */
const toReadableError = (err: unknown): string => {
  const message = err instanceof Error ? err.message : String(err)
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

/** 构建快照并导出 PPTX 落盘，返回文件路径 */
export const exportPptx = async (
  json: PptJsonDoc,
  size: { w: number; h: number },
  path: string
): Promise<string> => {
  try {
    const snapshot = await snapshotDoc(json, size)
    return await window.preload.ppt.exportPptx(snapshot, { path })
  } catch (err) {
    throw new Error(toReadableError(err))
  }
}

/** 构建快照并绘制指定页 PNG 落盘（单页 path 为文件，多页 path 为目录），返回文件路径列表 */
export const exportPptxToPngs = async (
  json: PptJsonDoc,
  size: { w: number; h: number },
  path: string,
  slides?: number[]
): Promise<string[]> => {
  try {
    const snapshot = await snapshotDoc(json, size)
    const indices = slides?.length
      ? slides.map((s) => s - 1)
      : snapshot.slides.map((_, i) => i)
    const images: string[] = []
    const pages: number[] = []
    for (const index of indices) {
      const slide = snapshot.slides[index]
      if (!slide) continue
      images.push(await paintSlideToPng(slide, size))
      pages.push(index + 1)
    }
    return await window.preload.ppt.writePngFiles(images, { targetPath: path, pages })
  } catch (err) {
    throw new Error(toReadableError(err))
  }
}

/** 离屏实测指定页（0 基索引）各节点的渲染包围盒（画布绝对坐标，ppt_inspect 用） */
export const inspectSlideBounds = async (
  json: PptJsonDoc,
  slideIndex: number,
  size: { w: number; h: number } = PPT_SLIDE_SIZE
): Promise<PptNodeBounds[]> => {
  const slide = json.slide[slideIndex]
  if (!slide) return []
  return measureSlideBounds(slide, json.theme, size)
}
