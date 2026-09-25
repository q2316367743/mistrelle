/**
 * 马赛克弹窗的绘制编排（底层 / 上层两层 canvas）：
 * 底层 = 原图 + 遮盖贴片（马赛克像素化 / 毛玻璃模糊），与画布叠加层共用同一套绘制原语
 * （mosaicDraw.ts），保证「弹窗所见 = 画布所得 = 导出所得」；上层 = 文字框描边 / 框选矩形 / 笔刷光标。
 * rAF 节流、缓存失效等编排留给 `useMosaicEditor`。
 */
import { drawCoverInto } from '@/windows/main/modules/canvas'
import type { MosaicCoverParams, MosaicGrid, MosaicRect } from '@/windows/main/modules/canvas'

/** 打码配色（canvas 2D 用不了 CSS 变量，由调用方读 token 后传入） */
export interface MosaicPalette {
  /** 未标记文字框 / 框选 / 笔刷光标 */
  accent: string
  /** 已标记文字框 */
  marked: string
  accentFill: string
}

/** contain 适配：显示缩放（上限 2× 放大）与显示尺寸（CSS 像素） */
export const fitDisplay = (
  imageW: number,
  imageH: number,
  availW: number,
  availH: number
): { scale: number; width: number; height: number } => {
  const scale = Math.min(availW / imageW, availH / imageH, 2)
  return { scale, width: imageW * scale, height: imageH * scale }
}

/** canvas 尺寸同步：backing store 按 dpr 放大、样式尺寸用显示像素；调用后用显示坐标绘制 */
export const prepareCanvas = (
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void => {
  const dpr = window.devicePixelRatio || 1
  const w = Math.max(1, Math.round(width * dpr))
  const h = Math.max(1, Math.round(height * dpr))
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

export interface MosaicStageOptions {
  image: HTMLImageElement
  /** 遮盖区域轮廓（图片像素坐标） */
  paths: number[][]
  cover: MosaicCoverParams
  /** 与图片同尺寸的网格（马赛克用） */
  grid: MosaicGrid
  /** 预算好的像素化小图（逐帧重绘时传入） */
  pixelated?: HTMLCanvasElement | null
  width: number
  height: number
}

/** 底层绘制：原图 + 遮盖区域贴片（区域为图片像素坐标，绘制尺寸为显示像素） */
export const paintStage = (ctx: CanvasRenderingContext2D, options: MosaicStageOptions): void => {
  const { image, width, height } = options
  ctx.clearRect(0, 0, width, height)
  ctx.drawImage(image, 0, 0, width, height)
  drawCoverInto(ctx, options)
}

export interface MosaicOverlayOptions {
  /** 与 MosaicEditMode 同形状（避免与编辑器互相 import） */
  mode: 'auto' | 'brush'
  /** 文字框（图片像素坐标）与标记态 */
  boxes: MosaicRect[]
  marked: Set<number>
  hovered: number
  /** 框选矩形 / 笔刷光标（显示坐标） */
  drag: { x: number; y: number; w: number; h: number } | null
  /** 笔刷光标位置与刷宽（显示像素） */
  pointer: { x: number; y: number } | null
  brushSize: number
  /** 橡皮擦：笔刷光标改描边色区分 */
  erasing: boolean
  scale: number
}

/** 上层绘制：文字框描边（已标记转绿虚线）/ 框选矩形 / 笔刷光标圈 */
export const paintOverlay = (
  ctx: CanvasRenderingContext2D,
  palette: MosaicPalette,
  options: MosaicOverlayOptions & { width: number; height: number }
): void => {
  const { mode, boxes, marked, hovered, drag, pointer, brushSize, erasing, scale, width, height } =
    options
  ctx.clearRect(0, 0, width, height)
  if (mode === 'auto') {
    boxes.forEach((box, i) => {
      const isMarked = marked.has(i)
      ctx.lineWidth = hovered === i ? 2 : 1
      ctx.strokeStyle = isMarked ? palette.marked : palette.accent
      ctx.setLineDash(isMarked ? [4, 3] : [])
      ctx.strokeRect(box.x * scale, box.y * scale, box.w * scale, box.h * scale)
    })
    ctx.setLineDash([])
    if (drag) {
      ctx.fillStyle = palette.accentFill
      ctx.fillRect(drag.x, drag.y, drag.w, drag.h)
      ctx.strokeStyle = palette.accent
      ctx.strokeRect(drag.x, drag.y, drag.w, drag.h)
    }
    return
  }
  if (pointer) {
    ctx.beginPath()
    ctx.arc(pointer.x, pointer.y, brushSize / 2, 0, Math.PI * 2)
    ctx.setLineDash(erasing ? [4, 3] : [])
    ctx.strokeStyle = erasing ? palette.marked : palette.accent
    ctx.stroke()
    ctx.setLineDash([])
  }
}
