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
import type {
  CanvasDoc,
  CanvasShadow,
  CanvasShape,
  CanvasStrokeAlign,
  CanvasStrokeCap,
  CanvasStrokeJoin
} from './canvasTypes'

export type CanvasRenderNode = Rect | Ellipse | Text | Line | LeaferImage | Polygon | Star | Path

/** 质感效果字段集合（供等比缩放透传） */
type CanvasShapeEffects = {
  cornerRadius?: number | number[]
  shadow?: CanvasShadow | CanvasShadow[]
  innerShadow?: CanvasShadow | CanvasShadow[]
  blendMode?: string
  blur?: number
  backgroundBlur?: number
  strokeCap?: CanvasStrokeCap
  strokeJoin?: CanvasStrokeJoin
  strokeAlign?: CanvasStrokeAlign
  dashPattern?: number[]
}

/**
 * 按缩放比例等比换算图形的质感效果字段。
 * 预览层是等比缩放坐标渲染的，阴影偏移 / 模糊半径 / 圆角 / 虚线若不随 scale 缩放，
 * 会与导出（scale=1）不一致，故对数值字段统一乘 scale。
 */
const scaleEffects = (shape: CanvasShape, scale: number): CanvasShapeEffects => {
  const scaleShadow = (s: CanvasShadow): CanvasShadow => ({
    ...s,
    x: s.x * scale,
    y: s.y * scale,
    blur: s.blur * scale,
    ...(s.spread != null ? { spread: s.spread * scale } : {})
  })
  const shadow = shape.shadow
    ? Array.isArray(shape.shadow)
      ? shape.shadow.map(scaleShadow)
      : scaleShadow(shape.shadow)
    : undefined
  const innerShadow = shape.innerShadow
    ? Array.isArray(shape.innerShadow)
      ? shape.innerShadow.map(scaleShadow)
      : scaleShadow(shape.innerShadow)
    : undefined
  return {
    cornerRadius: shape.cornerRadius,
    shadow,
    innerShadow,
    blendMode: shape.blendMode,
    blur: shape.blur != null ? shape.blur * scale : undefined,
    backgroundBlur: shape.backgroundBlur != null ? shape.backgroundBlur * scale : undefined,
    strokeCap: shape.strokeCap,
    strokeJoin: shape.strokeJoin,
    strokeAlign: shape.strokeAlign,
    dashPattern: shape.dashPattern?.map((n) => n * scale)
  }
}

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
    opacity: shape.opacity,
    ...scaleEffects(shape, scale)
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
        // 路径用节点整体缩放，效果字段（阴影/模糊/圆角）由 scaleX/Y 自动等比，这里原样透传
        ...scaleEffects(shape, 1),
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
