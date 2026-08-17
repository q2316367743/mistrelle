/**
 * PPTX 导出核心（主进程）：PptExportSnapshot（渲染进程 DOM 实测的绝对坐标快照）→
 * PptxGenJS 按坐标摆放。主进程不做任何布局——布局真相在渲染进程 CSS，此处只翻译：
 * px → inch（96dpi）/ pt（72pt=1in），items 数组序即 z 序。
 * 渐变填充（PptxGenJS 不支持）经 sharp 栅格化为 PNG 图片兜底；SVG 图片同理。
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import sharp from 'sharp'
import PptxGenJS from 'pptxgenjs'
import type {
  PptExportItem,
  PptExportSnapshot,
  PptFillInput,
  PptShadowInput,
  PptStrokeInput
} from '~/channels'

const PX_PER_IN = 96
const px2in = (px: number): number => px / PX_PER_IN
const px2pt = (px: number): number => (px / PX_PER_IN) * 72

/** 归一 hex（去 #；#RGB 展开） */
const hex = (color: string): string => {
  let value = color.replace('#', '')
  if (value.length === 3) value = [...value].map((c) => c + c).join('')
  return value.toUpperCase()
}

const fillInput = (fill: PptFillInput | undefined): PptxGenJS.ShapeFillProps | undefined => {
  if (!fill) return undefined
  if (fill.gradient) return undefined // 渐变走图片兜底（调用方处理）
  if (!fill.color) return undefined
  return {
    color: hex(fill.color),
    transparency: fill.transparency !== undefined ? Math.round(fill.transparency * 100) : undefined
  }
}

const lineInput = (stroke: PptStrokeInput | undefined): PptxGenJS.ShapeLineProps | undefined => {
  if (!stroke) return undefined
  return {
    color: hex(stroke.color),
    width: px2pt(stroke.width),
    dashType: stroke.dashType && stroke.dashType !== 'solid' ? (stroke.dashType as 'dash') : undefined
  }
}

/** 阴影 attr（0 = 上，顺时针）→ PptxGenJS angle（OOXML dir：0 = 右，顺时针） */
const shadowInput = (shadow: PptShadowInput | undefined): PptxGenJS.ShadowProps | undefined => {
  if (!shadow) return undefined
  return {
    type: shadow.type === 'inner' ? 'inner' : 'outer',
    color: hex(shadow.color),
    opacity: shadow.opacity ?? 0.4,
    blur: px2pt(shadow.blur ?? 8),
    offset: px2pt(shadow.offset ?? 4),
    angle: (((shadow.angle ?? 90) - 90) % 360 + 360) % 360
  }
}

/** shapeType → PptxGenJS 预设名（未收录回退 rect）。PptxGenJS 运行时接受字符串，
 * 其 ShapeType 仅为类型声明，不从默认导出暴露运行时对象。 */
const SHAPE_MAP: Record<string, string> = {
  rect: 'rect',
  roundRect: 'roundRect',
  ellipse: 'ellipse',
  circle: 'ellipse',
  oval: 'ellipse',
  triangle: 'triangle',
  diamond: 'diamond',
  star: 'star5',
  star5: 'star5',
  heart: 'heart',
  pentagon: 'pentagon',
  hexagon: 'hexagon',
  chevron: 'chevron',
  rightArrow: 'rightArrow',
  arrow: 'rightArrow',
  homePlate: 'homePlate',
  parallelogram: 'parallelogram',
  trapezoid: 'trapezoid',
  cross: 'plus',
  plus: 'plus'
}

const asShapeType = (shape: string): PptxGenJS.ShapeType =>
  shape as PptxGenJS.ShapeType

const ARROW_TYPES = new Set(['triangle', 'arrow', 'stealth', 'oval', 'diamond', 'none'])
const arrowType = (value: string | undefined): 'triangle' | undefined => {
  if (!value || value === 'false' || value === 'none') return undefined
  return ARROW_TYPES.has(value) ? (value as 'triangle') : 'triangle'
}

/** CSS 渐变串 → sharp 栅格化 PNG dataURL（PptxGenJS addImage 用） */
const gradientToPng = async (
  gradient: string,
  w: number,
  h: number
): Promise<string | null> => {
  const angleMatch = /([-\d.]+)deg/.exec(gradient)
  const angle = angleMatch ? Number(angleMatch[1]) : 135
  const rad = (angle * Math.PI) / 180
  const dx = Math.sin(rad)
  const dy = -Math.cos(rad)
  const x1 = 0.5 - dx / 2
  const y1 = 0.5 + dy / 2
  const x2 = 0.5 + dx / 2
  const y2 = 0.5 + dy / 2
  const stops = gradient.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))\s+([\d.]+)%/g) ?? []
  if (!stops.length) return null
  const stopsXml = stops
    .map((stop) => {
      const parts = stop.split(' ')
      const offset = parts.pop()
      return `<stop offset="${Number(offset) / 100}" stop-color="${parts.join(' ')}"/>`
    })
    .join('')
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.max(1, Math.round(w))}" ` +
    `height="${Math.max(1, Math.round(h))}"><defs>` +
    `<linearGradient id="g" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stopsXml}</linearGradient>` +
    `</defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`
  const png = await sharp(Buffer.from(svg), { density: 96 })
    .resize(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)))
    .png()
    .toBuffer()
  return `image/png;base64,${png.toString('base64')}`
}

/** 图片源归一：data URI（svg 经 sharp 转 PNG）/ 本地路径 */
const imageSource = async (
  src: string,
  w: number,
  h: number
): Promise<{ data?: string; path?: string }> => {
  if (!src.startsWith('data:')) return { path: src }
  const comma = src.indexOf(',')
  if (comma < 0) return {}
  const meta = src.slice(0, comma)
  const payload = src.slice(comma + 1)
  const isBase64 = meta.includes(';base64')
  const bytes = isBase64
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8')
  if (meta.includes('svg')) {
    const png = await sharp(bytes, { density: 96 })
      .resize(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)))
      .png()
      .toBuffer()
    return { data: `data:image/png;base64,${png.toString('base64')}` }
  }
  return {
    data: isBase64
      ? src
      : `data:${meta};base64,${bytes.toString('base64')}`
  }
}

const CHART_TYPE: Record<string, PptxGenJS.CHART_NAME> = {
  bar: 'bar',
  line: 'line',
  pie: 'pie',
  area: 'area',
  doughnut: 'doughnut',
  radar: 'radar'
}

/**
 * 快照 → PPTX 落盘，返回文件路径。
 */
export const exportSnapshotToPptx = async (
  snapshot: PptExportSnapshot,
  filePath: string
): Promise<string> => {
  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'PPT_CUSTOM', width: px2in(snapshot.w), height: px2in(snapshot.h) })
  pptx.layout = 'PPT_CUSTOM'

  for (const slide of snapshot.slides) {
    const s = pptx.addSlide()
    for (const item of slide.items) {
      await addItem(s, item)
    }
  }
  await mkdir(dirname(filePath), { recursive: true })
  const output = await pptx.write({ outputType: 'nodebuffer' as const })
  if (!(output instanceof Uint8Array)) throw new Error('PptxGenJS 未返回 nodebuffer')
  await writeFile(filePath, output)
  return filePath
}

const addItem = async (s: PptxGenJS.Slide, item: PptExportItem): Promise<void> => {
  const common = {
    x: px2in(item.x),
    y: px2in(item.y),
    w: px2in(item.w),
    h: px2in(item.h)
  }
  switch (item.kind) {
    case 'rect': {
      // 渐变填充 → 图片兜底；否则原生 rect
      if (item.fill?.gradient) {
        const png = await gradientToPng(item.fill.gradient, item.w, item.h)
        if (png) {
          s.addImage({ data: png, ...common })
          return
        }
      }
      const radius = item.radius ? Math.min(px2in(item.radius), Math.min(common.w, common.h) / 2) : undefined
      s.addShape(item.radius ? 'roundRect' : 'rect', {
        ...common,
        fill: fillInput(item.fill) ?? { type: 'none' },
        line: lineInput(item.stroke),
        rectRadius: radius,
        shadow: shadowInput(item.shadow),
        rotate: item.rotate
      })
      return
    }
    case 'ellipse': {
      s.addShape('ellipse', {
        ...common,
        fill: fillInput(item.fill) ?? { type: 'none' },
        line: lineInput(item.stroke),
        shadow: shadowInput(item.shadow),
        rotate: item.rotate
      })
      return
    }
    case 'shape': {
      s.addShape(asShapeType(SHAPE_MAP[item.shapeType] ?? 'rect'), {
        ...common,
        fill: fillInput(item.fill) ?? { type: 'none' },
        line: lineInput(item.stroke),
        shadow: shadowInput(item.shadow),
        rotate: item.rotate
      })
      return
    }
    case 'image': {
      const source = await imageSource(item.src, item.w, item.h)
      if (!source.data && !source.path) return
      s.addImage({
        ...common,
        ...(source.data ? { data: source.data } : { path: source.path }),
        sizing: {
          type: item.sizing === 'contain' ? 'contain' : 'cover',
          w: common.w,
          h: common.h
        },
        rotate: item.rotate
      })
      return
    }
    case 'line': {
      const x = Math.min(item.x1, item.x2)
      const y = Math.min(item.y1, item.y2)
      s.addShape('line', {
        x: px2in(x),
        y: px2in(y),
        w: px2in(Math.abs(item.x2 - item.x1)),
        h: px2in(Math.abs(item.y2 - item.y1)),
        flipH: item.x2 < item.x1,
        flipV: item.y2 < item.y1,
        line: {
          color: hex(item.color),
          width: px2pt(item.width),
          dashType:
            item.dashType && item.dashType !== 'solid' ? (item.dashType as 'dash') : undefined,
          beginArrowType: arrowType(item.beginArrow),
          endArrowType: arrowType(item.endArrow)
        }
      })
      return
    }
    case 'chart': {
      const type = CHART_TYPE[item.chartType] ?? 'bar'
      const series = item.data.map((ser) => ({ name: ser.name, labels: ser.labels, values: ser.values }))
      s.addChart(type, series, {
        ...common,
        showLegend: item.showLegend ?? false,
        showTitle: item.showTitle ?? false,
        title: item.title,
        chartColors: item.chartColors?.map(hex),
        chartColorsOpacity: 100,
        holeSize: item.chartType === 'doughnut' ? 50 : undefined,
        radarStyle: (item.radarStyle as 'standard') ?? undefined,
        barGapWidthPct: 60
      })
      return
    }
    case 'text': {
      if (!item.text) return
      s.addText(item.text, {
        ...common,
        fontFace: item.fontFamily,
        fontSize: px2pt(item.fontSize),
        color: hex(item.color),
        bold: item.bold || undefined,
        italic: item.italic || undefined,
        strike: item.strike ? 'sngStrike' : undefined,
        underline: item.underline ? { style: 'sng' } : undefined,
        align: item.align,
        valign: item.valign === 'middle' ? 'middle' : 'top',
        lineSpacing: px2pt(item.lineHeightPx),
        charSpacing: item.letterSpacingPx !== undefined ? px2pt(item.letterSpacingPx) : undefined,
        subscript: item.subscript || undefined,
        superscript: item.superscript || undefined,
        wrap: true,
        fit: 'none',
        margin: 0,
        isTextBox: true,
        rotate: item.rotate
      })
      return
    }
  }
}
