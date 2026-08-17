/**
 * 快照采集器（导出链路渲染侧核心）：PptSlideSurface 挂载后的 DOM 实测几何 + JSON attr
 * 样式语义 → PptExportSnapshot 二维数组（slides × items，items 序 = z 序）。
 * 原则：布局真相在 CSS（getBoundingClientRect），样式语义在 attr（token 解析与
 * attrStyle 同源），两者在快照处汇合固化——预览与导出因此天然一致。
 */
import type {
  PptChartItem,
  PptChartSeries,
  PptExportSlide,
  PptTheme,
  SlideNode
} from '../pptTypes'
import { attrBool, attrNum, resolveColor, toHex } from './attrStyle'
import { isEllipseShape } from './shapePaths'
import {
  elOf,
  emitDecoration,
  pushTextItem,
  rectOf,
  rectOfEl,
  shadowInput,
  textVisual,
  type SnapshotContext
} from './snapshotContext'
import { COMPOSITE_EMITTERS } from './snapshotComposite'

/** 快照项几何公共字段（rotate / opacity / zIndex / nodeId） */
interface ItemGeom {
  x: number
  y: number
  w: number
  h: number
  rotate?: number
  opacity?: number
  zIndex?: number
  nodeId?: string
}

const geom = (rect: { x: number; y: number; w: number; h: number }, node: SlideNode, zIndex: number | undefined): ItemGeom => {
  const attr = node.attr
  const result: ItemGeom = { ...rect, nodeId: node.id }
  const rotate = attrNum(attr, 'rotate')
  if (rotate !== undefined) result.rotate = rotate
  // opacity 语义为背景不透明度：有背景时已并入填充色，仅无背景场景落到元素透明度
  const opacity = attrNum(attr, 'opacity')
  if (opacity !== undefined && !attr.backgroundColor && !attr.backgroundGradient) {
    result.opacity = opacity
  }
  if (zIndex !== undefined) result.zIndex = zIndex
  return result
}

const parseChartSeries = (raw: string | undefined): PptChartSeries[] => {
  try {
    const parsed = JSON.parse(raw ?? '[]') as PptChartSeries[]
    return Array.isArray(parsed) ? parsed.filter((s) => Array.isArray(s.values)) : []
  } catch {
    return []
  }
}

const parseChartColors = (raw: string | undefined): string[] | undefined => {
  try {
    const parsed = JSON.parse(raw ?? 'null') as string[] | null
    return Array.isArray(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

/** Icon / Svg 内联 svg → 可独立渲染的 data URI（补宽高、替换 currentColor） */
const svgToDataUri = (svgEl: SVGElement, color: string | undefined, w: number, h: number): string => {
  const clone = svgEl.cloneNode(true) as SVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(Math.max(1, Math.round(w))))
  clone.setAttribute('height', String(Math.max(1, Math.round(h))))
  if (color) {
    const replaced = clone.outerHTML.replace(/currentColor/g, color)
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(replaced)}`
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(clone.outerHTML)}`
}

/** 基础 tag 采集（复合 tag 由 COMPOSITE_EMITTERS 承接） */
const emitNode = (ctx: SnapshotContext, node: SlideNode): void => {
  const composite = COMPOSITE_EMITTERS[node.tag]
  if (composite) {
    composite(ctx, node)
    return
  }
  if (node.tag === 'Line' || node.tag === 'Arrow') return // overlay 统一采集
  const rect = rectOf(ctx, node)
  if (!rect) return
  const attr = node.attr
  const zIndex = attrNum(attr, 'zIndex')

  switch (node.tag) {
    case 'VStack':
    case 'HStack':
    case 'Layer':
      emitDecoration(ctx, node, rect)
      if (Array.isArray(node.child)) node.child.forEach((child) => emitNode(ctx, child))
      return
    case 'Text': {
      // 文本背景 = highlight 优先（与 textStyle 覆盖顺序一致）
      emitDecoration(ctx, node, rect, resolveColor(attr.highlight, ctx.theme) ?? undefined)
      if (typeof node.child === 'string' && node.child) {
        pushTextItem(ctx, {
          rect,
          text: node.child,
          visual: textVisual(attr, ctx.theme),
          valign: 'top',
          nodeId: node.id,
          zIndex
        })
      }
      return
    }
    case 'Shape': {
      const shapeType = attr.shapeType ?? 'rect'
      const fill = {
        color: toHex(resolveColor(attr['fill.color'], ctx.theme) ?? '#4472C4'),
        transparency: attrNum(attr, 'fill.transparency')
      }
      const strokeColor = resolveColor(attr['line.color'], ctx.theme)
      const stroke = strokeColor
        ? {
            color: toHex(strokeColor),
            width: attrNum(attr, 'line.width', 1),
            dashType: attr['line.dashType']
          }
        : undefined
      const shadow = shadowInput(attr, ctx.theme)
      if (shapeType === 'rect') {
        ctx.items.push({ kind: 'rect', ...geom(rect, node, zIndex), fill, stroke, shadow })
      } else if (isEllipseShape(shapeType)) {
        ctx.items.push({ kind: 'ellipse', ...geom(rect, node, zIndex), fill, stroke, shadow })
      } else {
        ctx.items.push({
          kind: 'shape',
          ...geom(rect, node, zIndex),
          shapeType,
          fill,
          stroke,
          shadow
        })
      }
      if (typeof node.child === 'string' && node.child) {
        const visual = textVisual(attr, ctx.theme)
        pushTextItem(ctx, {
          rect,
          text: node.child,
          visual: { ...visual, align: (attr.textAlign as 'left' | 'center' | 'right') ?? 'center' },
          valign: 'middle',
          nodeId: node.id,
          zIndex
        })
      }
      return
    }
    case 'Image':
      emitDecoration(ctx, node, rect)
      ctx.items.push({
        kind: 'image',
        ...geom(rect, node, zIndex),
        src: attr.src ?? '',
        sizing: attr['sizing.type'] === 'contain' ? 'contain' : 'cover',
        nodeId: node.id
      })
      return
    case 'Icon': {
      const el = elOf(ctx, node)
      if (attr.variant) {
        const isCircle = attr.variant.startsWith('circle')
        ctx.items.push({
          kind: 'rect',
          ...geom(rect, node, zIndex),
          radius: isCircle ? Math.min(rect.w, rect.h) / 2 : Math.min(rect.w, rect.h) * 0.18,
          fill: { color: toHex(resolveColor(attr.bgColor, ctx.theme) ?? '#E0E0E0') },
          nodeId: node.id
        })
      }
      const glyph = el?.querySelector('svg')
      const glyphRect = rectOfEl(ctx, glyph ?? null)
      if (glyph && glyphRect) {
        ctx.items.push({
          kind: 'image',
          x: glyphRect.x,
          y: glyphRect.y,
          w: glyphRect.w,
          h: glyphRect.h,
          src: svgToDataUri(
            glyph,
            resolveColor(attr.color, ctx.theme),
            glyphRect.w,
            glyphRect.h
          ),
          nodeId: node.id,
          zIndex
        })
      }
      return
    }
    case 'Svg': {
      const el = elOf(ctx, node)
      const svgEl = el?.querySelector('svg')
      if (svgEl) {
        ctx.items.push({
          kind: 'image',
          ...geom(rect, node, zIndex),
          src: svgToDataUri(
            svgEl,
            resolveColor(attr.color, ctx.theme),
            rect.w,
            rect.h
          ),
          nodeId: node.id
        })
      }
      return
    }
    case 'Ul':
    case 'Ol': {
      emitDecoration(ctx, node, rect)
      for (const li of Array.isArray(node.child) ? node.child : []) {
        if (li.tag !== 'Li') continue
        const liEl = elOf(ctx, li)
        const visual = textVisual(li.attr, ctx.theme, node.attr)
        const markerEl = liEl?.querySelector('.ppt-list__marker')
        const markerRect = rectOfEl(ctx, markerEl ?? null)
        if (markerRect) {
          pushTextItem(ctx, {
            rect: markerRect,
            text: markerEl?.textContent ?? '',
            visual,
            valign: 'top',
            nodeId: li.id
          })
        }
        const textEl = liEl?.querySelector('.ppt-list__text')
        const textRect = rectOfEl(ctx, textEl ?? null)
        if (textRect && typeof li.child === 'string' && li.child) {
          pushTextItem(ctx, {
            rect: textRect,
            text: li.child,
            visual,
            valign: 'top',
            nodeId: li.id
          })
        }
      }
      return
    }
    case 'Chart': {
      emitDecoration(ctx, node, rect)
      const chart: PptChartItem = {
        kind: 'chart',
        ...geom(rect, node, zIndex),
        chartType: (attr.chartType ?? 'bar') as PptChartItem['chartType'],
        data: parseChartSeries(attr.data),
        chartColors: parseChartColors(attr.chartColors),
        title: attr.title,
        showTitle: attrBool(attr, 'showTitle') ?? undefined,
        showLegend: attrBool(attr, 'showLegend') ?? undefined,
        sparkline: attrBool(attr, 'sparkline') ?? undefined,
        radarStyle: attr.radarStyle
      }
      ctx.items.push(chart)
      return
    }
    default:
      return
  }
}

/** 几何公共字段已提取为 geom()（见文件顶部 ItemGeom） */


/** overlay（Line / Arrow）→ line 项（几何读 svg line attrs，箭头 / 虚线语义取 attr） */
const emitOverlayLines = (ctx: SnapshotContext, slide: SlideNode[]): void => {
  const nodeById = new Map<string, SlideNode>()
  const walk = (nodes: SlideNode[]): void => {
    for (const node of nodes) {
      if (node.id) nodeById.set(node.id, node)
      if (Array.isArray(node.child)) walk(node.child)
    }
  }
  walk(slide)
  ctx.surface.querySelectorAll('.ppt-surface__overlay g[data-node-id]').forEach((group) => {
    const line = group.querySelector('line')
    if (!line) return
    const nodeId = group.getAttribute('data-node-id') ?? undefined
    const node = nodeId ? nodeById.get(nodeId) : undefined
    const read = (name: string): number => Number(line.getAttribute(name)) || 0
    ctx.items.push({
      kind: 'line',
      x: Math.min(read('x1'), read('x2')),
      y: Math.min(read('y1'), read('y2')),
      w: Math.abs(read('x2') - read('x1')),
      h: Math.abs(read('y2') - read('y1')),
      x1: read('x1'),
      y1: read('y1'),
      x2: read('x2'),
      y2: read('y2'),
      color: toHex(line.getAttribute('stroke') ?? '#000000'),
      width: Number(line.getAttribute('stroke-width')) || 1,
      dashType: node?.attr.dashType,
      beginArrow:
        node && (node.attr.beginArrow !== undefined || node.attr['beginArrow.type'] !== undefined)
          ? String(node.attr.beginArrow ?? node.attr['beginArrow.type'])
          : undefined,
      endArrow:
        node && (node.attr.endArrow !== undefined || node.attr['endArrow.type'] !== undefined)
          ? String(node.attr.endArrow ?? node.attr['endArrow.type'])
          : undefined,
      nodeId
    })
  })
}

/**
 * 采集单页快照（surface 为 PptSlideSurface 根元素，需已挂载且布局稳定）。
 */
export const snapshotSlide = (
  surface: HTMLElement,
  slide: SlideNode[],
  theme: PptTheme
): PptExportSlide => {
  const ctx: SnapshotContext = { surface, base: surface.getBoundingClientRect(), theme, items: [] }
  slide.forEach((node) => emitNode(ctx, node))
  emitOverlayLines(ctx, slide)
  // z 序：按 zIndex 稳定排序（缺省 0 保持 DOM 顺序）
  ctx.items.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
  return { items: ctx.items }
}
