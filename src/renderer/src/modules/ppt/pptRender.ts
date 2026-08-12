/**
 * PPT 渲染封装（渲染进程侧）：调用 preload 桥触发主进程渲染 / 导出。
 * 渲染与导出全部在主进程完成（POM 为 ESM-only + resvg wasm Node-only 加载），
 * 渲染进程只负责显示 SVG 与传 (xml, 目标路径)，不经手导出字节。
 */
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

/** 构建 PPTX 并落盘（导出 PPTX），返回文件路径 */
export const exportPptx = async (
  xml: string,
  size: { w: number; h: number },
  path: string
): Promise<string> => {
  try {
    return await window.preload.ppt.exportPptx(xml, { ...size, path })
  } catch (err) {
    throw new Error(toReadableError(err))
  }
}

/** 渲染指定页 PNG 并落盘（单页 path 为文件，多页 path 为目录），返回文件路径列表 */
export const exportPptxToPngs = async (
  xml: string,
  size: { w: number; h: number },
  path: string,
  slides?: number[]
): Promise<string[]> => {
  try {
    return await window.preload.ppt.exportPptxToPngs(xml, { ...size, path, slides })
  } catch (err) {
    throw new Error(toReadableError(err))
  }
}
