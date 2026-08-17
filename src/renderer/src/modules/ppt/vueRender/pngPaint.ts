/**
 * PNG 位图绘制器（渲染进程 canvas）：把导出快照逐项绘制到离屏 canvas → PNG dataURL。
 * 与 PPTX 导出同源（同一份 PptExportSnapshot），字体 / 换行 / 渐变由 Chromium 原生
 * 处理（canvas measureText 换行比 SVG text 更接近预览）。图表经 echarts SSR SVG 位图化。
 */
import type { PptExportItem, PptExportSlide, PptFillInput } from '../pptTypes'
import { SHAPE_PATHS } from './shapePaths'
import { buildChartOption } from './chartOption'
import { renderChartOptionToSVG } from '@/modules/tool/components/design/chartRender'
import { resolveSrc } from './resolveSrc'

/** 图片缓存（dataURL / 路径 → HTMLImageElement） */
const imageCache = new Map<string, HTMLImageElement>()

const loadImage = async (src: string): Promise<HTMLImageElement | null> => {
  const url = src.startsWith('data:') ? src : await resolveSrc(src)
  if (!url) return null
  const cached = imageCache.get(url)
  if (cached) return cached
  const image = new Image()
  const loaded = new Promise<boolean>((resolve) => {
    image.onload = () => resolve(true)
    image.onerror = () => resolve(false)
  })
  image.src = url
  if (!(await loaded)) return null
  imageCache.set(url, image)
  return image
}

/** 解析 CSS linear-gradient → canvas 渐变（角度 0deg = 向上，顺时针） */
const gradientOf = (
  ctx: CanvasRenderingContext2D,
  gradient: string,
  x: number,
  y: number,
  w: number,
  h: number
): CanvasGradient | null => {
  const angleMatch = /([-\d.]+)deg/.exec(gradient)
  const angle = angleMatch ? Number(angleMatch[1]) : 135
  const rad = (angle * Math.PI) / 180
  const dx = Math.sin(rad)
  const dy = -Math.cos(rad)
  const cx = x + w / 2
  const cy = y + h / 2
  const half = Math.abs(w * dx) / 2 + Math.abs(h * dy) / 2
  const grad = ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half)
  const stops = gradient.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))\s+([\d.]+)%/g) ?? []
  for (const stop of stops) {
    const parts = stop.split(' ')
    const offset = Number(parts.pop())
    if (Number.isFinite(offset)) grad.addColorStop(Math.min(1, Math.max(0, offset / 100)), parts.join(' '))
  }
  if (!stops.length) return null
  return grad
}

const fillStyleOf = (
  ctx: CanvasRenderingContext2D,
  fill: PptFillInput | undefined,
  x: number,
  y: number,
  w: number,
  h: number
): string | CanvasGradient | null => {
  if (!fill) return null
  if (fill.gradient) return gradientOf(ctx, fill.gradient, x, y, w, h)
  if (fill.color) {
    return withAlpha(fill.color, fill.transparency !== undefined ? 1 - fill.transparency : 1)
  }
  return null
}

/** hex(#RGB/#RRGGBB) + alpha → rgba 串 */
const withAlpha = (color: string, alpha: number): string => {
  let value = color.startsWith('#') ? color.slice(1) : color
  if (value.length === 3) value = [...value].map((c) => c + c).join('')
  const r = parseInt(value.slice(0, 2), 16) || 0
  const g = parseInt(value.slice(2, 4), 16) || 0
  const b = parseInt(value.slice(4, 6), 16) || 0
  return `rgba(${r},${g},${b},${Math.min(1, Math.max(0, alpha))})`
}

const DASH_PATTERN: Record<string, number[]> = {
  dash: [6, 4],
  sysDash: [3, 3],
  sysDot: [1, 4],
  dot: [1, 4],
  dashDot: [8, 4, 2, 4],
  lgDash: [14, 6],
  lgDashDot: [14, 6, 2, 6],
  lgDashDotDot: [14, 6, 2, 6, 2, 6]
}

/** 文本换行（CJK 逐字、拉丁按词，measureText 实测宽度） */
const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    if (!paragraph) {
      lines.push('')
      continue
    }
    let current = ''
    for (const segment of paragraph.match(/[A-Za-z0-9@#$%^&*()_+=\-./]+|\s|./gu) ?? []) {
      const candidate = current + segment
      if (ctx.measureText(candidate).width > maxWidth && current) {
        lines.push(current)
        current = segment.trimStart()
      } else {
        current = candidate
      }
    }
    if (current) lines.push(current)
  }
  return lines
}

/** 旋转绘制（绕中心，度） */
const withRotate = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rotate: number | undefined,
  draw: () => void
): void => {
  if (!rotate) {
    draw()
    return
  }
  ctx.save()
  ctx.translate(x + w / 2, y + h / 2)
  ctx.rotate((rotate * Math.PI) / 180)
  ctx.translate(-x - w / 2, -y - h / 2)
  draw()
  ctx.restore()
}

/** 绘制单个快照项 */
const paintItem = async (ctx: CanvasRenderingContext2D, item: PptExportItem): Promise<void> => {
  const { x, y, w, h } = item
  ctx.save()
  ctx.globalAlpha = item.opacity ?? 1
  switch (item.kind) {
    case 'rect': {
      const fill = fillStyleOf(ctx, item.fill, x, y, w, h)
      const stroke = item.stroke
      withRotate(ctx, x, y, w, h, item.rotate, () => {
        const radius = item.radius ?? 0
        ctx.beginPath()
        ctx.roundRect(x, y, w, h, radius)
        if (fill) {
          ctx.fillStyle = fill
          ctx.fill()
        }
        if (stroke) {
          ctx.setLineDash(DASH_PATTERN[stroke.dashType ?? ''] ?? [])
          ctx.lineWidth = stroke.width
          ctx.strokeStyle = stroke.color
          ctx.stroke()
        }
      })
      break
    }
    case 'ellipse': {
      const fill = fillStyleOf(ctx, item.fill, x, y, w, h)
      ctx.beginPath()
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
      if (fill) {
        ctx.fillStyle = fill
        ctx.fill()
      }
      if (item.stroke) {
        ctx.lineWidth = item.stroke.width
        ctx.strokeStyle = item.stroke.color
        ctx.stroke()
      }
      break
    }
    case 'shape': {
      const pathData = SHAPE_PATHS[item.shapeType] ?? SHAPE_PATHS[item.shapeType === 'homePlate' ? 'pentagon' : ''] ?? null
      withRotate(ctx, x, y, w, h, item.rotate, () => {
        ctx.beginPath()
        if (item.shapeType === 'ellipse') {
          ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
        } else if (pathData) {
          const path = new Path2D(pathData)
          ctx.save()
          ctx.translate(x, y)
          ctx.scale(w / 100, h / 100)
          // Path2D 已在当前变换下绘制；Canvas 类型未声明 addPath，直接 fill/stroke path。
          ctx.fillStyle = fillStyleOf(ctx, item.fill, x, y, w, h) ?? 'transparent'
          ctx.fill(path)
          if (item.stroke) {
            ctx.lineWidth = item.stroke.width / Math.max(w / 100, h / 100)
            ctx.strokeStyle = item.stroke.color
            ctx.stroke(path)
          }
          ctx.restore()
          return
        } else {
          ctx.rect(x, y, w, h)
        }
        const fill = fillStyleOf(ctx, item.fill, x, y, w, h)
        if (fill) {
          ctx.fillStyle = fill
          ctx.fill()
        }
        if (item.stroke) {
          ctx.lineWidth = item.stroke.width
          ctx.strokeStyle = item.stroke.color
          ctx.stroke()
        }
      })
      break
    }
    case 'image': {
      const image = await loadImage(item.src)
      if (!image) break
      withRotate(ctx, x, y, w, h, item.rotate, () => {
        const contain = item.sizing === 'contain'
        const ratio = Math.min(w / image.width, h / image.height)
        const dw = contain ? image.width * ratio : w
        const dh = contain ? image.height * ratio : h
        // cover 居中裁切 / contain 居中放置
        const clipW = contain ? dw : w
        const clipH = contain ? dh : h
        ctx.save()
        ctx.beginPath()
        ctx.rect(x, y, clipW, clipH)
        ctx.clip()
        const scaleFit = item.sizing === 'contain' ? 1 : Math.max(w / image.width, h / image.height)
        const cw = item.sizing === 'contain' ? dw : image.width * scaleFit
        const ch = item.sizing === 'contain' ? dh : image.height * scaleFit
        ctx.drawImage(image, x + (w - cw) / 2, y + (h - ch) / 2, cw, ch)
        ctx.restore()
      })
      break
    }
    case 'line': {
      ctx.beginPath()
      ctx.moveTo(item.x1, item.y1)
      ctx.lineTo(item.x2, item.y2)
      ctx.setLineDash(DASH_PATTERN[item.dashType ?? ''] ?? [])
      ctx.lineWidth = item.width
      ctx.strokeStyle = item.color
      ctx.stroke()
      ctx.setLineDash([])
      const angle = (Math.atan2(item.y2 - item.y1, item.x2 - item.x1) * 180) / Math.PI
      const drawArrow = (px: number, py: number, deg: number): void => {
        const rad = (deg * Math.PI) / 180
        const size = Math.max(6, item.width * 3)
        const cos = Math.cos(rad)
        const sin = Math.sin(rad)
        const half = size * 0.42
        const pt = (dx: number, dy: number): [number, number] => [
          px + dx * cos - dy * sin,
          py + dx * sin + dy * cos
        ]
        ctx.beginPath()
        const a = pt(-size, -half)
        const b = pt(0, 0)
        const c = pt(-size, half)
        ctx.moveTo(a[0], a[1])
        ctx.lineTo(b[0], b[1])
        ctx.lineTo(c[0], c[1])
        ctx.closePath()
        ctx.fillStyle = item.color
        ctx.fill()
      }
      if (item.endArrow && item.endArrow !== 'none' && item.endArrow !== 'false') {
        drawArrow(item.x2, item.y2, angle)
      }
      if (item.beginArrow && item.beginArrow !== 'none' && item.beginArrow !== 'false') {
        drawArrow(item.x1, item.y1, angle + 180)
      }
      break
    }
    case 'chart': {
      const svg = await renderChartOptionToSVG(
        buildChartOption(
          Object.fromEntries([
            ['chartType', item.chartType],
            ['data', JSON.stringify(item.data)],
            ['chartColors', item.chartColors ? JSON.stringify(item.chartColors) : ''],
            ['title', item.title ?? ''],
            ['showTitle', item.showTitle ? 'true' : ''],
            ['showLegend', item.showLegend ? 'true' : ''],
            ['sparkline', item.sparkline ? 'true' : ''],
            ['radarStyle', item.radarStyle ?? '']
          ])
        ),
        Math.max(1, Math.round(w)),
        Math.max(1, Math.round(h))
      )
      const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
      if (image) ctx.drawImage(image, x, y, w, h)
      break
    }
    case 'text': {
      if (!item.text) break
      ctx.textBaseline = 'alphabetic'
      ctx.font = `${item.italic ? 'italic ' : ''}${item.bold ? '700 ' : '400 '}${item.fontSize}px ${item.fontFamily}`
      if (item.letterSpacingPx) {
        ;(ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${item.letterSpacingPx}px`
      }
      ctx.fillStyle = item.color
      const lines = wrapText(ctx, item.text, Math.max(1, w))
      const lineHeight = item.lineHeightPx || item.fontSize * 1.3
      const totalHeight = lines.length * lineHeight
      const startY =
        item.valign === 'middle' ? y + (h - totalHeight) / 2 + lineHeight * 0.8 : y + lineHeight * 0.8
      lines.forEach((line, i) => {
        const lineY = startY + i * lineHeight
        const width = ctx.measureText(line).width
        const lineX =
          item.align === 'center' ? x + (w - width) / 2 : item.align === 'right' ? x + w - width : x
        if (item.subscript || item.superscript) {
          const offset = item.subscript ? item.fontSize * 0.25 : -item.fontSize * 0.35
          ctx.save()
          ctx.font = `${item.fontSize * 0.7}px ${item.fontFamily}`
          ctx.fillText(line, lineX, lineY + offset)
          ctx.restore()
        } else {
          ctx.fillText(line, lineX, lineY)
          if (item.underline) {
            ctx.fillRect(lineX, lineY + item.fontSize * 0.12, width, Math.max(1, item.fontSize * 0.05))
          }
          if (item.strike) {
            ctx.fillRect(lineX, lineY - item.fontSize * 0.3, width, Math.max(1, item.fontSize * 0.05))
          }
        }
      })
      break
    }
  }
  ctx.restore()
}

/**
 * 单页快照 → PNG dataURL。
 * @param slide 页快照
 * @param size 画布尺寸（px）
 * @param scale 位图倍率（缺省 2，输出 2560×1440）
 */
export const paintSlideToPng = async (
  slide: PptExportSlide,
  size: { w: number; h: number },
  scale = 2
): Promise<string> => {
  const canvas = document.createElement('canvas')
  canvas.width = size.w * scale
  canvas.height = size.h * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建 canvas 上下文')
  ctx.scale(scale, scale)
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, size.w, size.h)
  for (const item of slide.items) {
    await paintItem(ctx, item)
  }
  return canvas.toDataURL('image/png')
}
