import {
  Leafer,
  Rect,
  Ellipse,
  Text,
  Line,
  Path,
  Polygon,
  Star,
  Group,
  Platform,
  Image as LeaferImage
} from 'leafer-editor'
// 注册动画能力到 Leafer 元素（依赖 @leafer-in/animate@2.2.9，leafer-editor 不含动画插件）
import '@leafer-in/animate'
import type { CanvasDoc, CanvasEffect, CanvasNode, CanvasPaint } from './canvasTypes'
import {
  computeLayoutBounds,
  layoutCanvasDoc,
  measureTextLineHeight,
  type CanvasLayoutNode
} from './canvasLayout'
import { ensureFontsForDoc } from './fontRegistry'

export type CanvasRenderNode =
  | Rect
  | Ellipse
  | Text
  | Line
  | LeaferImage
  | Polygon
  | Star
  | Path
  | Group

/** 过滤 undefined 字段，避免给 Leafer 传空值 */
const compact = (obj: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value
  }
  return out
}

/** 动画属性透传：无动画节点不产生任何开销 */
const buildAnimationProps = (node: CanvasNode): Record<string, unknown> =>
  compact({
    animation: node.animation,
    animationOut: node.animationOut
  })

/**
 * 图片引用统一为本地绝对路径（数据层），渲染时在此唯一转换：
 * 已是 URL（file / http(s) / data / blob）原样透传（AI 可合法填入远程地址），
 * 否则视为本地文件路径转 file href 交给 Leafer 加载。
 */
const resolveImageHref = (value: string | undefined): string | undefined => {
  if (!value) return undefined
  if (/^(file|https?|data|blob):/i.test(value)) return value
  return window.preload.net.pathToHref(value)
}

/** 解析 $name 调色板引用（纯色字符串或渐变 stops 内的颜色） */
const resolveColorString = (value: string, palette: Record<string, string>): string => {
  if (value.startsWith('$')) {
    const color = palette[value.slice(1)]
    if (color) return color
  }
  return value
}

const resolvePaint = (
  paint: CanvasPaint | undefined,
  palette: Record<string, string>
): CanvasPaint | undefined => {
  if (paint == null) return undefined
  if (typeof paint === 'string') {
    // 显式 'none' = 无填充 / 无描边：直接省略属性，避免给 Canvas 赋非法颜色导致状态泄漏
    if (paint.trim() === 'none') return undefined
    return resolveColorString(paint, palette)
  }
  // 防御：渐变对象必须是合法结构（stops 数组），否则视为无效填充，避免渲染崩溃
  if (typeof paint !== 'object' || !Array.isArray(paint.stops) || paint.stops.length === 0)
    return undefined
  return {
    ...paint,
    stops: paint.stops.map((stop) =>
      typeof stop === 'string'
        ? resolveColorString(stop, palette)
        : { ...stop, color: resolveColorString(stop.color, palette) }
    )
  }
}

/** 效果数组 → Leafer shadow / innerShadow / blur / backgroundBlur 属性 */
const toEffectsProps = (effects: CanvasEffect[] | undefined): Record<string, unknown> => {
  if (!Array.isArray(effects) || effects.length === 0) return {}
  const shadow: Array<Record<string, unknown>> = []
  const innerShadow: Array<Record<string, unknown>> = []
  const props: Record<string, unknown> = {}
  for (const effect of effects) {
    if (effect.visible === false) continue
    switch (effect.type) {
      case 'drop-shadow':
        shadow.push(
          compact({
            x: effect.x ?? 0,
            y: effect.y ?? 0,
            blur: effect.radius ?? 0,
            spread: effect.spread,
            color: effect.color ?? 'rgba(0,0,0,0.3)',
            visible: true
          })
        )
        break
      case 'inner-shadow':
        innerShadow.push(
          compact({
            x: effect.x ?? 0,
            y: effect.y ?? 0,
            blur: effect.radius ?? 0,
            spread: effect.spread,
            color: effect.color ?? 'rgba(0,0,0,0.3)',
            visible: true
          })
        )
        break
      case 'layer-blur':
        props.blur = { radius: effect.radius ?? 0 }
        break
      case 'background-blur':
        props.backgroundBlur = { radius: effect.radius ?? 0 }
        break
    }
  }
  if (shadow.length) props.shadow = shadow
  if (innerShadow.length) props.innerShadow = innerShadow
  return props
}

/** 节点公共属性（几何 + 变换 + 效果 + 动画），坐标为文档空间 */
const buildCommon = (layout: CanvasLayoutNode, effects: boolean): Record<string, unknown> => {
  const { node } = layout
  return compact({
    id: node.id,
    editable: true,
    x: layout.x,
    y: layout.y,
    rotation: node.rotation,
    opacity: node.opacity,
    blendMode: node.blendMode,
    visible: node.visible,
    ...(effects ? toEffectsProps(node.effects) : {}),
    ...buildAnimationProps(node)
  })
}

/** 描边属性（宽度已按像素，坐标为文档空间） */
const buildStrokeProps = (
  node: CanvasNode,
  stroke: CanvasPaint | undefined
): Record<string, unknown> =>
  compact({
    stroke,
    strokeWidth: node.strokeWidth,
    strokeCap: node.strokeCap,
    strokeJoin: node.strokeJoin,
    strokeAlign: node.strokeAlign,
    dashPattern: node.dashPattern
  })

/** G placeholder：灰色渐变底 + 居中短标签 */
const buildPlaceholder = (
  layout: CanvasLayoutNode,
  palette: Record<string, string>
): CanvasRenderNode => {
  const { node } = layout
  const group = new Group(compact({ ...buildCommon(layout, true) }))
  const bg = new Rect(
    compact({
      x: 0,
      y: 0,
      width: layout.width,
      height: layout.height,
      cornerRadius: node.cornerRadius,
      fill: resolvePaint(
        {
          type: 'linear',
          from: 'top-left',
          to: 'bottom-right',
          stops: ['#e2e8f0', '#cbd5e1']
        },
        palette
      )
    })
  )
  group.add(bg)
  const fontSize = Math.max(12, Math.min(24, Math.round(layout.width * 0.1)))
  const label = new Text(
    compact({
      x: 0,
      y: 0,
      width: layout.width,
      height: layout.height,
      textAlign: 'center',
      verticalAlign: 'center',
      text: node.placeholderLabel ?? '',
      fontSize,
      fill: '#64748b'
    })
  )
  group.add(label)
  return group
}

/** 将布局节点构建为 Leafer 元素（坐标为文档空间，缩放由根 Group 统一处理） */
export const buildNode = (
  layout: CanvasLayoutNode,
  palette: Record<string, string>
): CanvasRenderNode => {
  const { node } = layout
  if (node.placeholderLabel) return buildPlaceholder(layout, palette)

  // 显式 'none'：省略 fill/stroke 属性（resolvePaint 已把 'none' 归一为 undefined，
  // 此处用原始字段区分「显式无填充」与「未设置（走默认色兜底）」）
  const noFill = typeof node.fill === 'string' && node.fill.trim() === 'none'
  const fill = resolvePaint(node.fill, palette)
  const stroke = resolvePaint(node.stroke, palette)
  // 防御：布局尺寸可能为非有限值（脏数据），统一回退 0
  const width = Number.isFinite(layout.width) ? layout.width : 0
  const height = Number.isFinite(layout.height) ? layout.height : 0

  switch (node.type) {
    case 'group': {
      const group = new Group(
        compact({
          ...buildCommon(layout, true),
          ...(width > 0 ? { width } : {}),
          ...(height > 0 ? { height } : {})
        })
      )
      if (fill) {
        const background = new Rect(
          compact({
            x: 0,
            y: 0,
            width,
            height,
            cornerRadius: node.cornerRadius,
            fill,
            ...buildStrokeProps(node, stroke)
          })
        )
        group.add(background)
      }
      for (const child of layout.children) {
        try {
          group.add(buildNode(child, palette))
        } catch {
          // 跳过损坏的子节点，保证整张画布不因单个脏节点崩溃
        }
      }
      return group
    }
    case 'text': {
      // 布局与渲染共享同一行高事实源（measureTextLineHeight）：显式传布局 height + lineHeight(px) +
      // verticalAlign middle，使字形在布局框内垂直居中（布局 height = 行数 × 单行高），布局几何 = 渲染几何。
      // 预留调试点：若实测发现文字在容器内仍有垂直偏移（Leafer baseline 与字形包围盒的 <1~2px 差），
      // 优先调整 measureTextLineHeight 返回值，勿改 y（会破坏 canvas_inspect 与渲染的一致性）。
      const lineHeight = measureTextLineHeight(node, node.fontSize ?? 16)
      return new Text(
        compact({
          ...buildCommon(layout, true),
          text: node.text ?? '',
          fontSize: node.fontSize ?? 16,
          fontFamily: node.fontFamily,
          fontWeight:
            typeof node.fontWeight === 'number' ? String(node.fontWeight) : node.fontWeight,
          italic: node.italic,
          letterSpacing: node.letterSpacing,
          lineHeight: { type: 'px', value: lineHeight },
          textAlign: node.textAlign,
          textCase: node.textCase,
          ...(typeof node.width === 'number' || node.width === 'fill_container' ? { width } : {}),
          ...(height > 0 ? { height } : {}),
          verticalAlign: 'middle',
          autoSizeAlign: false,
          fill: noFill ? undefined : (fill ?? '#000000'),
          ...buildStrokeProps(node, stroke)
        })
      )
    }
    case 'rect':
      return new Rect(
        compact({
          ...buildCommon(layout, true),
          width,
          height,
          cornerRadius: node.cornerRadius,
          fill: noFill ? undefined : (fill ?? '#e6e6e6'),
          ...buildStrokeProps(node, stroke)
        })
      )
    case 'ellipse':
      return new Ellipse(
        compact({
          ...buildCommon(layout, true),
          width,
          height,
          fill: noFill ? undefined : (fill ?? '#e6e6e6'),
          ...buildStrokeProps(node, stroke)
        })
      )
    case 'polygon':
      return new Polygon(
        compact({
          ...buildCommon(layout, true),
          width,
          height,
          sides: node.sides ?? 3,
          startAngle: node.startAngle,
          fill: noFill ? undefined : (fill ?? '#e6e6e6'),
          ...buildStrokeProps(node, stroke)
        })
      )
    case 'star':
      return new Star(
        compact({
          ...buildCommon(layout, true),
          width,
          height,
          corners: node.corners ?? 5,
          innerRadius: node.innerRadius,
          startAngle: node.startAngle,
          fill: noFill ? undefined : (fill ?? '#e6e6e6'),
          ...buildStrokeProps(node, stroke)
        })
      )
    case 'line':
      // 折线颜色取自 stroke（兼容旧数据 fill 兜底）；保留 dashPattern / strokeCap 等描边属性
      return new Line(
        compact({
          ...buildCommon(layout, true),
          points: node.points ?? [],
          ...buildStrokeProps(node, stroke ?? fill ?? '#000000'),
          strokeWidth: node.strokeWidth ?? 1
        })
      )
    case 'path':
      return new Path(
        compact({
          ...buildCommon(layout, true),
          path: node.path ?? '',
          fill: noFill ? undefined : (fill ?? '#e6e6e6'),
          ...buildStrokeProps(node, stroke)
        })
      )
    case 'image':
      return new LeaferImage(
        compact({
          ...buildCommon(layout, true),
          ...(width > 0 ? { width } : {}),
          ...(height > 0 ? { height } : {}),
          url: resolveImageHref(node.imageUrl)
        })
      )
    case 'svg': {
      const url = node.svg ? Platform.toURL(node.svg, 'svg') : resolveImageHref(node.imageUrl)
      return new LeaferImage(
        compact({
          ...buildCommon(layout, true),
          ...(width > 0 ? { width } : {}),
          ...(height > 0 ? { height } : {}),
          url
        })
      )
    }
    default:
      // 兜底：未知节点类型渲染为空容器，绝不返回 undefined（避免 add(undefined) 崩溃）
      return new Group(compact({ ...buildCommon(layout, true) }))
  }
}

/**
 * 构建整张画布的渲染元素：背景 Rect + 全部根图层，
 * 统一包在一个可缩放的根 Group 中（缩放/平移由根 Group 变换完成，元素坐标保持文档空间）。
 */
export const buildDocElements = (
  doc: CanvasDoc,
  scale: number,
  offsetX = 0,
  offsetY = 0
): CanvasRenderNode[] => {
  const root = new Group({ x: offsetX, y: offsetY, scaleX: scale, scaleY: scale })
  root.add(
    new Rect({
      x: 0,
      y: 0,
      width: doc.width,
      height: doc.height,
      fill: doc.background || '#ffffff'
    })
  )
  const palette = doc.palette ?? {}
  for (const layout of layoutCanvasDoc(doc)) {
    try {
      root.add(buildNode(layout, palette))
    } catch {
      // 跳过损坏的根图层，保证整张画布不因单个脏节点崩溃
    }
  }
  return [root]
}

/** 画布导出区域：画布绝对坐标矩形 */
export interface CanvasExportRegion {
  x: number
  y: number
  width: number
  height: number
}

/**
 * 计算画布内某节点（含全部子树）的绝对包围盒，供按节点导出。
 * 未找到返回 null；节点自身与后代盒子取并集（兼容 0 尺寸 hug 容器）。
 * 复用 computeLayoutBounds 的父链累加：layout 树子节点坐标是相对父盒，
 * 旧实现直接取 target.x 会漏祖先位移，深层嵌套节点包围盒错误。
 */
export const computeNodeBounds = (doc: CanvasDoc, id: string): CanvasExportRegion | null => {
  const all = computeLayoutBounds(doc)
  const byId = new Map(all.map((b) => [b.id, b]))
  const target = byId.get(id)
  if (!target) return null
  const isDescendantOf = (bounds: { id: string; parentId?: string }): boolean => {
    let parentId = bounds.parentId
    while (parentId != null) {
      if (parentId === id) return true
      parentId = byId.get(parentId)?.parentId
    }
    return false
  }
  let minX = target.x
  let minY = target.y
  let maxX = target.x + target.width
  let maxY = target.y + target.height
  for (const b of all) {
    if (b.id === id || !isDescendantOf(b)) continue
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.width)
    maxY = Math.max(maxY, b.y + b.height)
  }
  return normalizeRegion({ x: minX, y: minY, width: maxX - minX, height: maxY - minY })
}

/** 归一化导出区域：数值有效、非负，宽高至少 1（防御脏数据） */
export const normalizeRegion = (
  region: Partial<CanvasExportRegion> | undefined
): CanvasExportRegion => {
  const x = region?.x != null && Number.isFinite(region.x) ? Math.max(0, Math.round(region.x)) : 0
  const y = region?.y != null && Number.isFinite(region.y) ? Math.max(0, Math.round(region.y)) : 0
  const w =
    region?.width != null && Number.isFinite(region.width)
      ? Math.max(1, Math.round(region.width))
      : 1
  const h =
    region?.height != null && Number.isFinite(region.height)
      ? Math.max(1, Math.round(region.height))
      : 1
  return { x, y, width: w, height: h }
}

/** 画布导出区域四舍五入为整数（Leafer screenshot 需要整数坐标） */
const roundRegion = (region: CanvasExportRegion): CanvasExportRegion => ({
  x: Math.round(region.x),
  y: Math.round(region.y),
  width: Math.max(1, Math.round(region.width)),
  height: Math.max(1, Math.round(region.height))
})

/** 动画元素的最小接口（@leafer-in/animate 运行时向元素注入 animate()） */
interface AnimatedElementLike {
  animate?: () => { stop(): void } | undefined
  children?: unknown
}

/** 遍历 Leafer 子节点（LeafList 非数组，统一走 forEach） */
const eachChild = (children: unknown, fn: (child: unknown) => void): void => {
  ;(children as { forEach?: (cb: (item: unknown) => void) => void } | undefined)?.forEach?.(fn)
}

/**
 * 将根元素树中所有带动画的元素推进到结束态（静态导出用）：
 * 动画 autoplay 默认开启，直接导出会抓到播放中间态（如渐入动画首帧 opacity=0），
 * 先对每个动画实例 stop()（即 complete → 落到 endingStyle）再导出，保证静态图 = 设计终态。
 */
export const settleAnimations = (roots: CanvasRenderNode[]): void => {
  const walk = (element: unknown): void => {
    const animated = element as AnimatedElementLike
    animated.animate?.()?.stop()
    eachChild(animated.children, walk)
  }
  for (const root of roots) walk(root)
}

/**
 * 离屏渲染画布为 PNG Blob（原始文档分辨率，与视口缩放无关）。
 * 缺省导出整张画布（0,0 → doc 尺寸，越界元素裁剪）；传 region 可导出指定矩形，
 * 供「设计在画布内某容器 / 卡片」时按区域导出，保证导出尺寸与设计尺寸一致。
 */
export const exportCanvasPng = async (
  doc: CanvasDoc,
  region?: CanvasExportRegion
): Promise<Blob> => {
  // 先确保画布用到的字体已加载（资源库 / 在线字体走 FontFace，系统字体 Chromium 原生可用）
  await ensureFontsForDoc(doc)
  const r = region ? roundRegion(region) : { x: 0, y: 0, width: doc.width, height: doc.height }
  const width = Math.max(1, r.width)
  const height = Math.max(1, r.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.style.position = 'absolute'
  canvas.style.left = '-9999px'
  canvas.style.top = '0'
  document.body.appendChild(canvas)
  const offscreen = new Leafer({ view: canvas, width, height })
  try {
    const elements = buildDocElements(doc, 1)
    for (const element of elements) {
      offscreen.add(element)
    }
    // 先停到动画结束态，避免 PNG 抓到播放中间帧（渐入/打字机动画尤其明显）
    settleAnimations(elements)
    // screenshot 限定导出矩形：默认整张画布，region 时导出指定区域（含裁剪），尺寸与设计一致
    // 文件名不能带扩展名（带 '.' 会触发浏览器下载），blob: true 走 toBlob 返回 Blob
    const result = await offscreen.export('png', { blob: true, screenshot: { ...r } })
    if (!(result.data instanceof Blob)) throw new Error('导出图片数据无效')
    return result.data
  } finally {
    offscreen.destroy()
    canvas.remove()
  }
}
