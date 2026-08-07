/**
 * 图片文件信息解析：读取本地图片的格式与宽高。
 *
 * 基于 uTools 内置 Sharp（inject.sharp.metadata）：在主进程侧读取图片文件头 / 元信息，
 * 只把小型 metadata 对象传回渲染进程——不把全量图片字节读进渲染进程内存，避免大图拖垮渲染进程。
 * 仅支持 uTools 环境；sharp 不可用时返回 null（浏览器 / ZTools 暂不支持）。
 */

export interface ImageInfo {
  /** 实际格式：png / jpeg / webp / gif 等（libvips 按内容判定，与扩展名无关） */
  format: string
  width: number
  height: number
  /** 文件大小（字节） */
  size: number
}

/**
 * 读取本地图片文件并解析格式 / 宽高 / 大小；失败（非图片 / 文件损坏 / sharp 不可用）返回 null。
 */
export const readImageInfo = async (path: string): Promise<ImageInfo | null> => {
  try {
    const sharp = window.preload.inject.sharp
    if (!sharp) return null
    const meta = await sharp.metadata(path)
    if (!meta.width || !meta.height) return null
    return {
      format: meta.format ?? '',
      width: meta.width,
      height: meta.height,
      size: meta.size ?? 0
    }
  } catch {
    return null
  }
}
