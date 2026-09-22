/**
 * 遮盖绘制原语（纯函数、无状态）：弹窗预览与画布叠加层共用同一套绘制，
 * 保证「弹窗所见 = 画布所得 = 导出所得」。
 * 目标画布尺寸可不同于图片尺寸，几何一律按「目标像素 / 图片像素」的缩放比换算。
 */
import type { ImageCoverStyle } from '@common/types/mosaic'
import type { MosaicCoverParams, MosaicGrid } from './mosaicGrid'

/** 轮廓点 → 当前路径（调用方负责 beginPath / clip / fill；点数不足直接跳过） */
export const traceRegionPath = (
  ctx: CanvasRenderingContext2D,
  points: number[],
  scale: number
): void => {
  if (points.length < 6) return
  ctx.moveTo(points[0] * scale, points[1] * scale)
  for (let i = 2; i + 1 < points.length; i += 2) {
    ctx.lineTo(points[i] * scale, points[i + 1] * scale)
  }
  ctx.closePath()
}

/** 像素化小图（cols×rows，块内平均）——马赛克底图的中间量，缓存复用可省掉整图降采样 */
export const createPixelatedSmall = (
  image: HTMLImageElement,
  grid: MosaicGrid
): HTMLCanvasElement | null => {
  const small = document.createElement('canvas')
  small.width = grid.cols
  small.height = grid.rows
  const smallCtx = small.getContext('2d')
  if (!smallCtx) return null
  smallCtx.drawImage(image, 0, 0, grid.cols, grid.rows)
  return small
}

/** 把像素化小图 nearest 放大画进目标 ctx（与 main 侧粗化同网格） */
const drawPixelatedInto = (
  ctx: CanvasRenderingContext2D,
  small: HTMLCanvasElement,
  grid: MosaicGrid,
  width: number,
  height: number
): void => {
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(
    small,
    0,
    0,
    grid.cols,
    grid.rows,
    0,
    0,
    Math.max(1, Math.round(width)),
    Math.max(1, Math.round(height))
  )
}

export interface MosaicDrawOptions {
  image: HTMLImageElement
  /** 遮盖区域轮廓（图片像素坐标） */
  paths: number[][]
  cover: MosaicCoverParams
  /** 与图片同尺寸的网格（马赛克用；毛玻璃忽略） */
  grid: MosaicGrid
  /** 目标绘制尺寸（显示像素 / 叠加层像素），图片按此尺寸缩放 */
  width: number
  height: number
  /** 预算好的像素化小图（逐帧重绘时传入，省掉每帧整图降采样） */
  pixelated?: HTMLCanvasElement | null
}

/**
 * 按区域绘制遮盖：区域路径裁剪后，马赛克贴像素化底图、毛玻璃贴高斯模糊底图。
 * 区域外不绘制（透明），毛玻璃为「背景模糊」式（模糊取自原图，区域边缘无透明渗出）。
 */
export const drawCoverInto = (ctx: CanvasRenderingContext2D, options: MosaicDrawOptions): void => {
  const { image, paths, cover, grid, width, height } = options
  if (!paths.length) return
  const natural = image.naturalWidth
  const scale = natural > 0 ? width / natural : 1
  ctx.save()
  ctx.beginPath()
  for (const points of paths) traceRegionPath(ctx, points, scale)
  ctx.clip()
  if (cover.style === 'blur') {
    ctx.filter = `blur(${Math.max(0, cover.blurPx * scale)}px)`
    ctx.drawImage(image, 0, 0, width, height)
  } else {
    const small = options.pixelated ?? createPixelatedSmall(image, grid)
    if (small) drawPixelatedInto(ctx, small, grid, width, height)
  }
  ctx.restore()
}

/** 遮盖方式文案（弹窗 / 属性面板共用） */
export const coverStyleLabel = (style: ImageCoverStyle): string =>
  style === 'blur' ? '毛玻璃' : '马赛克'
