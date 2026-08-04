import {
  Leafer,
  Rect,
  Ellipse,
  Text,
  Line,
  Path,
  Polygon,
  Star,
  Platform,
  Image as LeaferImage
} from 'leafer-editor'
import type { CanvasDoc, CanvasShape } from '@/modules/tool/components/canvas/canvasTypes'

export type CanvasRenderNode = Rect | Ellipse | Text | Line | LeaferImage | Polygon | Star | Path

/** 手动等比缩放每个图形坐标，将 doc 空间映射到指定缩放比例并平移到容器内；id/editable 为 editor 选中预留映射 */
export const scaleShape = (
  shape: CanvasShape,
  scale: number,
  offsetX = 0,
  offsetY = 0
): CanvasRenderNode => {
  const base = {
    id: shape.id,
    editable: true,
    x: shape.x * scale + offsetX,
    y: shape.y * scale + offsetY,
    rotation: shape.rotation,
    opacity: shape.opacity
  }
  const strokeStyle = {
    stroke: shape.stroke,
    strokeWidth: shape.strokeWidth != null ? shape.strokeWidth * scale : undefined
  }
  switch (shape.type) {
    case 'rect':
      return new Rect({
        ...base,
        width: (shape.width ?? 0) * scale,
        height: (shape.height ?? 0) * scale,
        fill: shape.fill ?? '#e6e6e6',
        ...strokeStyle
      })
    case 'ellipse':
      return new Ellipse({
        ...base,
        width: (shape.width ?? 0) * scale,
        height: (shape.height ?? 0) * scale,
        fill: shape.fill ?? '#e6e6e6',
        ...strokeStyle
      })
    case 'polygon':
      return new Polygon({
        ...base,
        width: (shape.width ?? 0) * scale,
        height: (shape.height ?? 0) * scale,
        sides: shape.sides ?? 3,
        startAngle: shape.startAngle,
        fill: shape.fill ?? '#e6e6e6',
        ...strokeStyle
      })
    case 'star':
      return new Star({
        ...base,
        width: (shape.width ?? 0) * scale,
        height: (shape.height ?? 0) * scale,
        corners: shape.corners ?? 5,
        innerRadius: shape.innerRadius,
        startAngle: shape.startAngle,
        fill: shape.fill ?? '#e6e6e6',
        ...strokeStyle
      })
    case 'text':
      return new Text({
        ...base,
        text: shape.text ?? '',
        fontSize: (shape.fontSize ?? 16) * scale,
        fontFamily: shape.fontFamily,
        fontWeight: shape.fontWeight,
        fill: shape.textColor ?? '#000000'
      })
    case 'line':
      return new Line({
        ...base,
        x: 0,
        y: 0,
        points: (shape.points ?? []).map((n, i) => n * scale + (i % 2 === 0 ? offsetX : offsetY)),
        stroke: shape.stroke ?? '#000000',
        strokeWidth: (shape.strokeWidth ?? 1) * scale,
        opacity: shape.opacity
      })
    case 'path':
      // 路径字符串坐标无法手动等比，改用元素 scaleX/Y 整体缩放；x/y 不再预乘 scale，避免二次缩放
      return new Path({
        id: shape.id,
        editable: true,
        x: shape.x + offsetX,
        y: shape.y + offsetY,
        rotation: shape.rotation,
        opacity: shape.opacity,
        scaleX: scale,
        scaleY: scale,
        path: shape.path ?? '',
        fill: shape.fill ?? '#e6e6e6',
        stroke: shape.stroke,
        strokeWidth: shape.strokeWidth
      })
    case 'image':
      // 宽高缺省时按图片原始尺寸显示
      return new LeaferImage({
        ...base,
        ...(shape.width != null ? { width: shape.width * scale } : {}),
        ...(shape.height != null ? { height: shape.height * scale } : {}),
        url: shape.imageUrl
      })
    case 'svg': {
      // 内联 SVG 字符串转 blob url 渲染，否则按 svg 文件 / url 渲染
      const url = shape.svg ? Platform.toURL(shape.svg, 'svg') : shape.imageUrl
      return new LeaferImage({
        ...base,
        ...(shape.width != null ? { width: shape.width * scale } : {}),
        ...(shape.height != null ? { height: shape.height * scale } : {}),
        url
      })
    }
  }
}

/**
 * 离屏渲染画布为 PNG Blob（原始文档分辨率，与视口缩放无关）。
 * 导出目标为整张画布（含背景），与选中状态无关。
 */
export const exportCanvasPng = async (doc: CanvasDoc): Promise<Blob> => {
  const width = Math.max(1, Math.round(doc.width))
  const height = Math.max(1, Math.round(doc.height))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.style.position = 'absolute'
  canvas.style.left = '-9999px'
  canvas.style.top = '0'
  document.body.appendChild(canvas)
  const offscreen = new Leafer({ view: canvas, width, height })
  try {
    offscreen.add(
      new Rect({
        x: 0,
        y: 0,
        width,
        height,
        fill: doc.background || '#ffffff'
      })
    )
    for (const shape of doc.shapes) {
      offscreen.add(scaleShape(shape, 1))
    }
    // 文件名不能带扩展名（带 '.' 会触发浏览器下载），blob: true 走 toBlob 返回 Blob
    const result = await offscreen.export('png', { blob: true })
    if (!(result.data instanceof Blob)) throw new Error('导出图片数据无效')
    return result.data
  } finally {
    offscreen.destroy()
    canvas.remove()
  }
}
