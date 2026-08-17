/**
 * 快照采集共享上下文与工具（snapshot.ts 主 walker 与 snapshotComposite.ts 复合节点共用）：
 * 几何取 DOM（布局真相），样式语义取 JSON attr + theme 解析（与 attrStyle 同一套函数）。
 */
import type {
  PptExportItem,
  PptFillInput,
  PptRectItem,
  PptShadowInput,
  PptStrokeInput,
  PptTheme,
  SlideNode
} from '../pptTypes'
import { attrBool, attrNum, bgAlpha, resolveColor, TEXT_DEFAULTS, toHex } from './attrStyle'
import { localRect, type LocalRect } from './overlayLinks'

/** 采集上下文：页画布元素 + 基准矩形 + 主题 + 产出 items */
export interface SnapshotContext {
  surface: HTMLElement
  base: DOMRect
  theme: PptTheme
  items: PptExportItem[]
}

/** 节点 → 对应 DOM 元素（data-node-id 精确匹配） */
export const elOf = (ctx: SnapshotContext, node: SlideNode): Element | null =>
  node.id ? ctx.surface.querySelector(`[data-node-id="${node.id}"]`) : null

/** 元素 → 画布局部矩形；元素缺失返回 null */
export const rectOfEl = (ctx: SnapshotContext, el: Element | null): LocalRect | null =>
  el ? localRect(el, ctx.base) : null

/** 节点 → 画布局部矩形（元素缺失返回 null，调用方跳过该节点） */
export const rectOf = (ctx: SnapshotContext, node: SlideNode): LocalRect | null =>
  rectOfEl(ctx, elOf(ctx, node))

/** 文本视觉参数（attr 解析，缺省与 textStyle 一致；fallbackAttr 支持 Ul → Li 回退） */
export interface TextVisual {
  fontSize: number
  color: string
  fontFamily: string
  bold: boolean
  italic: boolean
  strike: boolean
  underline: boolean
  align: 'left' | 'center' | 'right'
  lineHeightPx: number
  letterSpacingPx?: number
  subscript: boolean
  superscript: boolean
}

export const textVisual = (
  attr: Record<string, string>,
  theme: PptTheme,
  fallbackAttr?: Record<string, string>
): TextVisual => {
  const eff = (key: string): string | undefined =>
    attr[key] !== undefined ? attr[key] : fallbackAttr?.[key]
  const fontSize = attrNum(
    attr,
    'fontSize',
    attrNum(fallbackAttr ?? {}, 'fontSize', TEXT_DEFAULTS.fontSize)
  )
  const lineHeight = attrNum(
    attr,
    'lineHeight',
    attrNum(fallbackAttr ?? {}, 'lineHeight', TEXT_DEFAULTS.lineHeight)
  )
  const color =
    resolveColor(eff('color'), theme) ??
    gradientFirstColor(eff('textGradient')) ??
    '#000000'
  const align = eff('textAlign')
  return {
    fontSize,
    color: toHex(color),
    fontFamily: eff('fontFamily') ?? TEXT_DEFAULTS.fontFamily,
    bold: attrBool(attr, 'bold') ?? attrBool(fallbackAttr ?? {}, 'bold') ?? false,
    italic: attrBool(attr, 'italic') ?? false,
    strike: attrBool(attr, 'strike') ?? false,
    underline: attrBool(attr, 'underline') ?? false,
    align: align === 'center' || align === 'right' ? align : 'left',
    lineHeightPx: fontSize * lineHeight,
    letterSpacingPx: (() => {
      const value = attrNum(attr, 'letterSpacing') ?? attrNum(fallbackAttr ?? {}, 'letterSpacing')
      return value
    })(),
    subscript: attrBool(attr, 'subscript') ?? false,
    superscript: attrBool(attr, 'superscript') ?? false
  }
}

/** 从 CSS 渐变串提取首个颜色（textGradient 导出降级用） */
export const gradientFirstColor = (gradient: string | undefined): string | undefined => {
  if (!gradient) return undefined
  const match = /#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/.exec(gradient)
  return match ? match[0] : undefined
}

/** 追加文本项（几何 + 视觉参数 → PptTextItem） */
export const pushTextItem = (
  ctx: SnapshotContext,
  opts: {
    rect: LocalRect
    text: string
    visual: TextVisual
    valign: 'top' | 'middle'
    nodeId?: string
    zIndex?: number
  }
): void => {
  ctx.items.push({
    kind: 'text',
    x: opts.rect.x,
    y: opts.rect.y,
    w: opts.rect.w,
    h: opts.rect.h,
    text: opts.text,
    fontSize: opts.visual.fontSize,
    color: opts.visual.color,
    fontFamily: opts.visual.fontFamily,
    bold: opts.visual.bold,
    italic: opts.visual.italic,
    strike: opts.visual.strike,
    underline: opts.visual.underline,
    align: opts.visual.align,
    valign: opts.valign,
    lineHeightPx: opts.visual.lineHeightPx,
    letterSpacingPx: opts.visual.letterSpacingPx,
    subscript: opts.visual.subscript || undefined,
    superscript: opts.visual.superscript || undefined,
    nodeId: opts.nodeId,
    zIndex: opts.zIndex
  })
}

/** 读取容器内 svg 连线（每条带所属 g 的 data-node-id） */
export interface SvgLineInfo {
  nodeId?: string
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  width: number
}

export const svgLinesOf = (container: Element): SvgLineInfo[] => {
  const lines: SvgLineInfo[] = []
  container.querySelectorAll('svg line').forEach((line) => {
    const read = (name: string): number => Number(line.getAttribute(name)) || 0
    const group = line.closest('g[data-node-id]')
    lines.push({
      nodeId: group?.getAttribute('data-node-id') ?? undefined,
      x1: read('x1'),
      y1: read('y1'),
      x2: read('x2'),
      y2: read('y2'),
      color: toHex(line.getAttribute('stroke') ?? '#000000'),
      width: Number(line.getAttribute('stroke-width')) || 1
    })
  })
  return lines
}

/** 统一边框（border.*）→ PptStrokeInput */
export const uniformStroke = (
  attr: Record<string, string>,
  theme: PptTheme
): PptStrokeInput | undefined => {
  const color = resolveColor(attr['border.color'], theme)
  const width = attrNum(attr, 'border.width', NaN)
  if (!color && !Number.isFinite(width)) return undefined
  return {
    color: toHex(color ?? '#000000'),
    width: Number.isFinite(width) ? width : 1,
    dashType: attr['border.dashType']
  }
}

/** 阴影 attr → PptShadowInput */
export const shadowInput = (
  attr: Record<string, string>,
  theme: PptTheme
): PptShadowInput | undefined => {
  const blur = attrNum(attr, 'shadow.blur', NaN)
  if (!Number.isFinite(blur)) return undefined
  const color = resolveColor(attr['shadow.color'], theme) ?? '#000000'
  return {
    type: attr['shadow.type'] === 'inner' ? 'inner' : 'outer',
    color: toHex(color),
    opacity: attrNum(attr, 'shadow.opacity', 0.4),
    blur,
    offset: attrNum(attr, 'shadow.offset', 4),
    angle: attrNum(attr, 'shadow.angle', 90)
  }
}

/**
 * 节点自身装饰（背景 / 渐变 / 边框 / 阴影 / 圆角）→ rect 项。
 * 高亮背景（Text.highlight）由调用方传入 overrideFillColor。
 * 无任何可视装饰时不产出。backgroundImage 另出 image 项。
 */
export const emitDecoration = (
  ctx: SnapshotContext,
  node: SlideNode,
  rect: LocalRect,
  overrideFillColor?: string
): void => {
  const attr = node.attr
  const alpha = bgAlpha(attr)
  const bgColor = resolveColor(attr.backgroundColor, ctx.theme)
  const gradient = attr.backgroundGradient
  const stroke = uniformStroke(attr, ctx.theme)
  const shadow = shadowInput(attr, ctx.theme)
  const radius = attrNum(attr, 'borderRadius', NaN)
  const fill: PptFillInput | undefined = overrideFillColor
    ? { color: toHex(overrideFillColor) }
    : bgColor || gradient
      ? {
          color: bgColor ? toHex(bgColor) : undefined,
          gradient: gradient || undefined,
          transparency: alpha !== undefined ? 1 - alpha : undefined
        }
      : alpha !== undefined
        ? { color: '#FFFFFF', transparency: 1 - alpha }
        : undefined
  const hasFill = Boolean(fill && (fill.color || fill.gradient))
  if (!hasFill && !stroke && !shadow && !Number.isFinite(radius)) return
  const item: PptRectItem = {
    kind: 'rect',
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: rect.h,
    nodeId: node.id,
    zIndex: attrNum(attr, 'zIndex')
  }
  if (fill) item.fill = fill
  if (stroke) item.stroke = stroke
  if (shadow) item.shadow = shadow
  if (Number.isFinite(radius)) item.radius = radius
  ctx.items.push(item)
  // 背景图（cover 铺满盒子）
  const bgSrc = attr['backgroundImage.src']
  if (bgSrc) {
    ctx.items.push({
      kind: 'image',
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h,
      src: bgSrc,
      sizing: attr['backgroundImage.sizing'] === 'contain' ? 'contain' : 'cover',
      nodeId: node.id,
      zIndex: attrNum(attr, 'zIndex')
    })
  }
}
