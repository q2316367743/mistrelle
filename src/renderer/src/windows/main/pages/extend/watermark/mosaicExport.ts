/**
 * 打水印页面的导出：把当前遮盖按**原图尺寸**烘焙成 PNG 并写出（原图不动）。
 * 绘制复用与预览同一套原语（drawCoverInto），故「页面所见 = 导出所得」。
 * 不走 main 侧 sharp 烘焙：预览用的是浏览器解码图（已修正 EXIF 方向），
 * 而 sharp 读原始文件不修 EXIF，手机照片会与 OCR 坐标错位。
 */
import { MessageUtil } from '@/utils/modal'
import {
  createGrid,
  createPixelatedSmall,
  drawCoverInto,
  loadImageElement,
  resolveCover
} from '@/windows/main/modules/canvas'
import type { MosaicApplyPayload } from '@/windows/main/components/mosaic/useMosaicEditor'

/** 页面支持的图片扩展名（遮盖与 OCR 都吃位图，故不含 svg / gif / ico） */
export const WATERMARK_IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'bmp']

/** 渲染带遮盖的整图：离屏 canvas 按自然尺寸绘制（scale=1，与预览同算法） */
const renderMaskedBlob = async (source: string, payload: MosaicApplyPayload): Promise<Blob> => {
  const image = await loadImageElement(source)
  if (!image) throw new Error('图片加载失败')
  const width = image.naturalWidth
  const height = image.naturalHeight
  const grid = createGrid(width, height, payload.cellPx)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布上下文')
  ctx.drawImage(image, 0, 0, width, height)
  drawCoverInto(ctx, {
    image,
    paths: payload.regions.map((region) => region.points),
    cover: resolveCover(payload),
    grid,
    pixelated: createPixelatedSmall(image, grid),
    width,
    height
  })
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('导出图片失败')
  return blob
}

/** 导出：渲染 → 选保存路径 → 写文件；用户取消保存时静默返回（不提示成功 / 失败） */
export const exportMosaicImage = async (
  source: string,
  payload: MosaicApplyPayload
): Promise<void> => {
  try {
    const blob = await renderMaskedBlob(source, payload)
    const base = window.preload.path.basename(source, window.preload.path.extname(source))
    const target = await window.preload.inject.dialog.save({
      title: '导出图片',
      defaultPath: `${base}-打水印.png`,
      filters: [{ name: 'PNG 图片', extensions: ['png'] }]
    })
    if (!target) return
    await window.preload.fs.writeBinaryFile(target, await blob.arrayBuffer())
    MessageUtil.success('已导出图片')
  } catch (e) {
    MessageUtil.error('导出失败', e)
    // 失败必须向上抛：编辑器据此不触发「应用成功」收场
    throw e
  }
}
