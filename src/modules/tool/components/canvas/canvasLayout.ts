import type { CanvasDoc, CanvasLayoutSize, CanvasNode } from './canvasTypes'

/**
 * 布局引擎：把图层树解析为「绝对坐标 + 具体尺寸」的布局树。
 * - 自由定位为主：非布局组内子节点直接按 x/y 渲染
 * - group 可选自动布局：layout: horizontal / vertical / wrap 时按 gap / padding / 对齐排布
 * - fill_container / hug_contents 仅布局组内有效
 * 预览与导出共用同一实现（单一事实源）。
 */

export interface CanvasLayoutNode {
  node: CanvasNode
  /** 绝对坐标（画布空间） */
  x: number
  y: number
  /** 解析后的具体尺寸 */
  width: number
  height: number
  children: CanvasLayoutNode[]
}

const FILL = 'fill_container'

const isFill = (v: unknown): v is 'fill_container' => v === FILL

/** 解析 padding：number | [h,v] | [t,r,b,l] → [top,right,bottom,left] */
const resolvePadding = (padding: number | number[] | undefined): [number, number, number, number] => {
  if (padding == null) return [0, 0, 0, 0]
  if (typeof padding === 'number') return [padding, padding, padding, padding]
  if (padding.length === 2) return [padding[0], padding[1], padding[0], padding[1]]
  if (padding.length === 4) return [padding[0], padding[1], padding[2], padding[3]]
  return [0, 0, 0, 0]
}

/** 文本高度估算（行高因子，用于 hug 文本） */
const estimateLineHeight = (node: CanvasNode, fontSize: number): number => {
  if (typeof node.lineHeight === 'number') return node.lineHeight
  return Math.round(fontSize * 1.35)
}

/** 文本宽度近似测量（canvas 2d 测量，兜底按字符数估算），用于 hug 文本 */
const measureTextWidth = (node: CanvasNode, fontSize: number): number => {
  const text = node.text ?? ''
  if (!text) return 0
  const family = node.fontFamily || 'sans-serif'
  const weight = typeof node.fontWeight === 'number' ? String(node.fontWeight) : node.fontWeight || '400'
  const spacing = node.letterSpacing ?? 0
  let width: number
  try {
    const ctx = document.createElement('canvas').getContext('2d')
    if (ctx) {
      ctx.font = `${weight} ${fontSize}px ${family}`
      width = ctx.measureText(text).width
    } else {
      width = estimateTextWidth(text, fontSize)
    }
  } catch {
    width = estimateTextWidth(text, fontSize)
  }
  if (spacing) width += text.length * spacing
  return Math.ceil(width)
}

const estimateTextWidth = (text: string, fontSize: number): number => {
  return [...text].reduce((acc, ch) => acc + (/[\u4e00-\u9fff]/.test(ch) ? fontSize : fontSize * 0.55), 0)
}

/**
 * 解析单个节点的具体尺寸。
 * @param size   节点的 width/height 字段
 * @param parentSize 布局父内容区在该轴上的尺寸（fill_container 参考；未定义时按自然尺寸）
 */
const resolveAxisSize = (
  size: number | CanvasLayoutSize | undefined,
  parentSize: number | undefined,
  hugSize: number
): number => {
  if (typeof size === 'number') return size
  if (isFill(size)) return parentSize ?? hugSize
  return hugSize // hug_contents 或 undefined → 自然尺寸
}

/** 叶子节点（非 group）的自然尺寸 */
const resolveLeafHug = (node: CanvasNode): { width: number; height: number } => {
  switch (node.type) {
    case 'text': {
      const fontSize = node.fontSize ?? 16
      return { width: measureTextWidth(node, fontSize), height: estimateLineHeight(node, fontSize) }
    }
    case 'image':
    case 'svg':
      // 图片 / svg 原始尺寸无法同步获取：无显式尺寸时按父内容区或 0 处理
      return { width: 0, height: 0 }
    default:
      return { width: 0, height: 0 }
  }
}

const isGroup = (node: CanvasNode): boolean => node.type === 'group'
const hasLayout = (node: CanvasNode): boolean => isGroup(node) && (node.layout ?? 'none') !== 'none'

/**
 * 递归布局：返回子节点相对父内容区原点（含 padding 已计入 x/y）的布局节点。
 * @param node            当前节点
 * @param parentW         布局父内容区宽度（fill_container 参考）
 * @param parentH         布局父内容区高度（fill_container 参考）
 */
const layoutTree = (node: CanvasNode, parentW: number | undefined, parentH: number | undefined): CanvasLayoutNode => {
  const children = Array.isArray(node.children) ? node.children : []

  if (!hasLayout(node)) {
    // 自由定位容器（含普通叶子）
    const pad = resolvePadding(node.padding)
    const contentW = parentW != null && parentW > 0 ? parentW - pad[1] - pad[3] : undefined
    const contentH = parentH != null && parentH > 0 ? parentH - pad[0] - pad[2] : undefined

    const childLayouts = children.map((child) => {
      const c = layoutTree(child, contentW, contentH)
      const layoutPositioning = child.layoutPositioning ?? 'AUTO'
      // 布局父（parent 有 layout）内的 AUTO 子节点由父排布；这里仅处理自由容器与 ABSOLUTE 子节点
      const x = pad[3] + (layoutPositioning === 'ABSOLUTE' ? child.x ?? 0 : child.x ?? 0)
      const y = pad[0] + (layoutPositioning === 'ABSOLUTE' ? child.y ?? 0 : child.y ?? 0)
      c.x += x
      c.y += y
      return c
    })

    // 组尺寸：显式 / fill → 用父内容；hug / undefined → 叶子按自然尺寸，容器按子节点扩展
    const leaf = !isGroup(node)
    const leafHug = leaf ? resolveLeafHug(node) : { width: 0, height: 0 }
    const hugW = leaf ? leafHug.width : childLayouts.reduce((m, c) => Math.max(m, c.x + c.width), 0)
    const hugH = leaf ? leafHug.height : childLayouts.reduce((m, c) => Math.max(m, c.y + c.height), 0)
    const width = resolveAxisSize(node.width, parentW, hugW)
    const height = resolveAxisSize(node.height, parentH, hugH)

    return {
      node,
      x: 0,
      y: 0,
      width,
      height,
      children: childLayouts
    }
  }

  // ── 自动布局组 ──
  const pad = resolvePadding(node.padding)
  const defW = typeof node.width === 'number' ? node.width : isFill(node.width) ? (parentW ?? 0) : undefined
  const defH = typeof node.height === 'number' ? node.height : isFill(node.height) ? (parentH ?? 0) : undefined
  const contentW = defW != null ? defW - pad[1] - pad[3] : undefined
  const contentH = defH != null ? defH - pad[0] - pad[2] : undefined

  const flow: CanvasLayoutNode[] = []
  const absolute: CanvasLayoutNode[] = []
  for (const child of children) {
    const c = layoutTree(child, contentW, contentH)
    if ((child.layoutPositioning ?? 'AUTO') === 'ABSOLUTE') {
      c.x += pad[3] + (child.x ?? 0)
      c.y += pad[0] + (child.y ?? 0)
      absolute.push(c)
    } else {
      flow.push(c)
    }
  }

  const gap = node.gap ?? 0
  const primary = node.primaryAxisAlignItems ?? 'MIN'
  const counter = node.counterAxisAlignItems ?? 'MIN'
  const horizontal = node.layout === 'horizontal' || node.layout === 'wrap'
  const vertical = node.layout === 'vertical' || node.layout === 'wrap'

  // 主轴尺寸：先固定尺寸，fill 均分剩余
  const fixedTotal = flow.reduce((m, c) => m + (horizontal ? c.width : c.height), 0)
  const fillCount = flow.filter((c) => isFill(horizontal ? c.node.width : c.node.height)).length
  const available = (horizontal ? contentW : contentH) ?? Infinity
  const fillUnit =
    fillCount > 0 && available !== Infinity
      ? Math.max(0, (available - fixedTotal - gap * Math.max(flow.length - 1, 0)) / fillCount)
      : 0
  for (const c of flow) {
    if (horizontal && isFill(c.node.width)) c.width = fillUnit
    if (vertical && isFill(c.node.height)) c.height = fillUnit
  }

  // 主轴排布：mainStart 为第一个元素起点，mainStep 为元素间距
  const totalPrimary = flow.reduce((m, c) => m + (horizontal ? c.width : c.height), 0)
  const gapTotal = gap * Math.max(flow.length - 1, 0)
  const mainAvailable = available !== Infinity ? available : totalPrimary + gapTotal
  const free = Math.max(0, mainAvailable - totalPrimary - gapTotal)
  let mainStart = 0
  let mainStep = gap
  if (primary === 'CENTER') mainStart = free / 2
  else if (primary === 'MAX') mainStart = free
  else if (primary === 'SPACE_BETWEEN' && flow.length > 1) mainStep = gap + free / (flow.length - 1)
  else if (primary === 'SPACE_EVENLY' && flow.length > 0) {
    mainStart = free / (flow.length + 1)
    mainStep = gap + free / (flow.length + 1)
  }

  if (node.layout === 'horizontal' || node.layout === 'vertical') {
    // 线性排布
    let cursor = mainStart
    for (const c of flow) {
      if (horizontal) c.x = pad[3] + cursor
      else c.y = pad[0] + cursor
      cursor += (horizontal ? c.width : c.height) + mainStep
    }

    // 交叉轴对齐
    for (const c of flow) {
      const crossAvailable = horizontal ? contentH : contentW
      if (crossAvailable == null) continue
      const crossSize = horizontal ? c.height : c.width
      const freeCross = Math.max(0, crossAvailable - crossSize)
      let offset = 0
      if (counter === 'CENTER') offset = freeCross / 2
      else if (counter === 'MAX') offset = freeCross
      if (horizontal) c.y = pad[0] + offset
      else c.x = pad[3] + offset
    }
  } else if (node.layout === 'wrap') {
    // 换行栅格：按主轴方向逐项放置，超出主轴长度换行
    const mainLimit = (horizontal ? contentW : contentH) ?? Infinity
    let cursor = 0
    let crossCursor = 0
    let lineMax = 0
    for (const c of flow) {
      const mainSize = horizontal ? c.width : c.height
      const crossSize = horizontal ? c.height : c.width
      if (cursor + mainSize > mainLimit && cursor > 0) {
        cursor = 0
        crossCursor += lineMax + gap
        lineMax = 0
      }
      if (horizontal) c.x = pad[3] + cursor
      else c.y = pad[0] + cursor
      if (horizontal) c.y = pad[0] + crossCursor
      else c.x = pad[3] + crossCursor
      cursor += mainSize + gap
      lineMax = Math.max(lineMax, crossSize)
    }
  }

  // 自动布局组尺寸：显式 / fill → 用父内容；hug → 由内容扩展
  const allChild = [...flow, ...absolute]
  const hugW = allChild.reduce((m, c) => Math.max(m, c.x + c.width - pad[3]), pad[3]) + pad[3] + pad[1]
  const hugH = allChild.reduce((m, c) => Math.max(m, c.y + c.height - pad[0]), pad[0]) + pad[0] + pad[2]
  const width = resolveAxisSize(node.width, parentW, hugW)
  const height = resolveAxisSize(node.height, parentH, hugH)

  return {
    node,
    x: 0,
    y: 0,
    width,
    height,
    children: [...flow, ...absolute]
  }
}

/** 布局整张画布：返回根图层（绝对坐标，画布空间） */
export const layoutCanvasDoc = (doc: CanvasDoc): CanvasLayoutNode[] => {
  return (doc.nodes ?? []).map((node) => {
    const root = layoutTree(node, doc.width, doc.height)
    root.x = node.x ?? 0
    root.y = node.y ?? 0
    return root
  })
}
