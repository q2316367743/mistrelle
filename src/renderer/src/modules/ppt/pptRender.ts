/**
 * PPT 渲染封装（渲染进程侧）：调用 preload 桥触发主进程渲染。
 * 渲染逻辑全部在主进程（POM 为 ESM-only + resvg wasm Node-only 加载），
 * 渲染进程只负责显示 SVG / 导出字节落盘。
 */

/** PNG 导出结果（主进程按页返回字节） */
export interface PptPngResult {
  page: number
  bytes: ArrayBuffer
}

/** 清理 Electron invoke 错误的包装前缀，保留原始错误文本（如 POM 的 ParseXmlError 列表） */
const toReadableError = (err: unknown): string => {
  const message = err instanceof Error ? err.message : String(err)
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

/** 渲染 POM XML 为每页 SVG 字符串数组（预览链路） */
export const renderPptxToSvgs = async (
  xml: string,
  size: { w: number; h: number }
): Promise<string[]> => {
  try {
    return await window.preload.ppt.renderPptxToSvgs(xml, size)
  } catch (err) {
    throw new Error(toReadableError(err))
  }
}

/** 构建 PPTX 字节（导出 PPTX 用） */
export const buildPptxBytes = async (
  xml: string,
  size: { w: number; h: number }
): Promise<ArrayBuffer> => {
  try {
    return await window.preload.ppt.buildPptxBytes(xml, size)
  } catch (err) {
    throw new Error(toReadableError(err))
  }
}

/** 渲染指定页（1 起始，缺省全部）为 PNG 字节（导出 PNG 用） */
export const renderPptxToPngs = async (
  xml: string,
  size: { w: number; h: number },
  slides?: number[]
): Promise<PptPngResult[]> => {
  try {
    return await window.preload.ppt.renderPptxToPngs(xml, { ...size, slides })
  } catch (err) {
    throw new Error(toReadableError(err))
  }
}
