import type { CanvasDoc, CanvasLayoutSize, CanvasNode, CanvasNodeType } from './canvasTypes'

/**
 * 布局引擎：把图层树解析为「绝对坐标 + 具体尺寸」的布局树。
 * 采用 flexbox 两阶段算法（对齐 figma auto-layout 语义）：
 * - measureTree：先递归测量子节点自然尺寸，确定容器尺寸（hug = 非 fill 子决定 / fill = 父约束 / 显式）
 * - arrangeTree：基于确定的容器内容区尺寸，做主轴 / 交叉轴排布与 fill 拉伸
 * 关键语义（一次定死，避免补丁）：
 * - hug 容器交叉轴 = max(非 fill 子交叉轴自然尺寸) + padding；fill 子拉伸到内容区
 * - 主轴 fill 需要容器有确定主轴尺寸（显式 / 父约束）；hug 容器内无剩余空间不拉伸
 * - wrap 分支保留原换行逻辑，行内交叉轴对齐列为后续
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

/**
 * 文本单行高度（px），布局与渲染共用的单一事实源：
 * - lineHeight 显式数字 → 倍率 × fontSize（Figma/CSS 语义，AI 指南约定不变）
 * - 缺省 / 'AUTO' → 真实字形高度（canvas 2d 绝对测量：actualBoundingBoxAscent + Descent），
 *   与 Leafer 渲染同源，使布局几何 = 渲染几何，消除原 1.2×字号 估算造成的垂直偏差（≈height/8）。
 * 预留调试点：Leafer 行内 baseline 取自字体 metrics，可能与 measureText 的字形包围盒存在 <1~2px
 * 差异；若实测分组内文字仍有垂直偏移，优先在此调整返回值（或渲染层 lineHeight 的 px 值），勿改布局 y。
 */
export const measureTextLineHeight = (node: CanvasNode, fontSize: number): number => {
  if (typeof node.lineHeight === 'number') return Math.round(fontSize * node.lineHeight)
  const text = node.text ?? ''
  if (text) {
    const family = node.fontFamily || 'sans-serif'
    const weight = typeof node.fontWeight === 'number' ? String(node.fontWeight) : node.fontWeight || '400'
    try {
      const ctx = document.createElement('canvas').getContext('2d')
      if (ctx) {
        ctx.font = `${weight} ${fontSize}px ${family}`
        const m = ctx.measureText(text)
        const ascent = m.actualBoundingBoxAscent ?? 0
        const descent = m.actualBoundingBoxDescent ?? 0
        if (ascent + descent > 0) return Math.ceil(ascent + descent)
      }
    } catch {
      // canvas 测量失败，走兜底
    }
  }
  return Math.round(fontSize * 1.2)
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
const resolveLeafHug = (node: CanvasNode, parentW?: number): { width: number; height: number } => {
  switch (node.type) {
    case 'text': {
      const fontSize = node.fontSize ?? 16
      const lineHeight = measureTextLineHeight(node, fontSize)
      const textWidth = measureTextWidth(node, fontSize)
      // 可用宽度决定换行行数：显式数字优先；fill_container 用父内容宽；hug/缺省按单行不换行
      const availW =
        typeof node.width === 'number'
          ? node.width
          : node.width === FILL
            ? parentW ?? textWidth
            : textWidth
      const rows = Math.max(1, Math.ceil(textWidth / Math.max(availW, 1)))
      return { width: textWidth, height: rows * lineHeight }
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

// ── 阶段一：measureTree（测量自然尺寸） ──────────────────────

/**
 * 递归测量节点在给定父约束下的自然尺寸。
 * - fill 轴返回「父约束或自身内容」（用于父决定 hug 尺寸时排除 fill 子贡献）
 * - hug 组交叉轴 = max(非 fill 子交叉轴自然尺寸) + padding（flexbox 语义）
 */
const measureTree = (node: CanvasNode, parentW: number | undefined, parentH: number | undefined): { width: number; height: number } => {
  const children = Array.isArray(node.children) ? node.children : []
  const pad = resolvePadding(node.padding)

  if (!hasLayout(node)) {
    // 自由定位容器（含普通叶子）
    if (!isGroup(node)) {
      const leafHug = resolveLeafHug(node, parentW)
      return {
        width: resolveAxisSize(node.width, parentW, leafHug.width),
        height: resolveAxisSize(node.height, parentH, leafHug.height)
      }
    }
    const contentW = parentW != null && parentW > 0 ? parentW - pad[1] - pad[3] : undefined
    const contentH = parentH != null && parentH > 0 ? parentH - pad[0] - pad[2] : undefined
    let hugW = 0
    let hugH = 0
    for (const child of children) {
      const s = measureTree(child, contentW, contentH)
      hugW = Math.max(hugW, (child.x ?? 0) + s.width)
      hugH = Math.max(hugH, (child.y ?? 0) + s.height)
    }
    return {
      width: resolveAxisSize(node.width, parentW, hugW),
      height: resolveAxisSize(node.height, parentH, hugH)
    }
  }

  // 自动布局组
  const defW = typeof node.width === 'number' ? node.width : isFill(node.width) ? (parentW ?? 0) : undefined
  const defH = typeof node.height === 'number' ? node.height : isFill(node.height) ? (parentH ?? 0) : undefined
  const contentW = defW != null ? defW - pad[1] - pad[3] : undefined
  const contentH = defH != null ? defH - pad[0] - pad[2] : undefined

  const horizontal = node.layout === 'horizontal' || node.layout === 'wrap'
  const gap = node.gap ?? 0
  const mainPad = horizontal ? pad[1] + pad[3] : pad[0] + pad[2]
  const crossPad = horizontal ? pad[0] + pad[2] : pad[1] + pad[3]

  const childSizes = children.map((child) => measureTree(child, contentW, contentH))
  let mainSum = 0
  let crossMax = 0
  let fillCount = 0
  let flowCount = 0
  let absMaxX = 0
  let absMaxY = 0
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const s = childSizes[i]
    if ((child.layoutPositioning ?? 'AUTO') === 'ABSOLUTE') {
      absMaxX = Math.max(absMaxX, (child.x ?? 0) + s.width)
      absMaxY = Math.max(absMaxY, (child.y ?? 0) + s.height)
      continue
    }
    flowCount++
    const mainFill = horizontal ? isFill(child.width) : isFill(child.height)
    if (mainFill) {
      fillCount++
      continue
    }
    mainSum += horizontal ? s.width : s.height
    crossMax = Math.max(crossMax, horizontal ? s.height : s.width)
  }

  // hug 尺寸：主轴 = 非 fill 流元素和 + gap + padding；交叉轴 = 非 fill 流元素 max + padding
  const flowMain = mainSum + gap * Math.max(flowCount - 1, 0) + mainPad
  const flowCross = crossMax + crossPad
  const hugW = horizontal ? Math.max(flowMain, absMaxX + pad[1] + pad[3]) : Math.max(flowCross, absMaxX + pad[1] + pad[3])
  const hugH = horizontal ? Math.max(flowCross, absMaxY + pad[0] + pad[2]) : Math.max(flowMain, absMaxY + pad[0] + pad[2])

  return {
    width: resolveAxisSize(node.width, parentW, hugW),
    height: resolveAxisSize(node.height, parentH, hugH)
  }
}

// ── 阶段二：arrangeTree（基于确定尺寸排布） ───────────────────

interface ChildPlan {
  child: CanvasNode
  base: { width: number; height: number }
  abs: boolean
  /** 排布确定的最终尺寸（主轴 / 交叉轴） */
  pMain: number
  pCross: number
  /** 相对容器内容区原点的位置 */
  relX: number
  relY: number
}

/**
 * 递归排布：返回节点结构，坐标语义为「相对父盒」（根节点由 layoutCanvasDoc
 * 设为相对画布的绝对坐标），与 buildNode 的 Leafer group.add 相对定位一致。
 * 内部先测量子节点尺寸、排布，再递归 arrange 子节点，最后把排布确定的尺寸写回子节点。
 * @param parentW 父内容区尺寸（fill_container 参考）
 * @param parentH 父内容区高度
 * @param posX    本节点盒相对父盒的 x（根节点 = 相对画布）
 * @param posY    本节点盒相对父盒的 y（根节点 = 相对画布）
 */
const arrangeTree = (
  node: CanvasNode,
  parentW: number | undefined,
  parentH: number | undefined,
  posX: number,
  posY: number
): CanvasLayoutNode => {
  const children = Array.isArray(node.children) ? node.children : []
  const pad = resolvePadding(node.padding)
  const size = measureTree(node, parentW, parentH)
  const result: CanvasLayoutNode = { node, x: posX, y: posY, width: size.width, height: size.height, children: [] }

  if (!hasLayout(node)) {
    // 自由定位容器（含叶子）：子节点按自身 x/y 绝对定位
    if (!isGroup(node)) return result
    const contentW = parentW != null && parentW > 0 ? parentW - pad[1] - pad[3] : undefined
    const contentH = parentH != null && parentH > 0 ? parentH - pad[0] - pad[2] : undefined
    for (const child of children) {
      const c = arrangeTree(child, contentW, contentH, pad[3] + (child.x ?? 0), pad[0] + (child.y ?? 0))
      result.children.push(c)
    }
    return result
  }

  // ── 自动布局组 ──
  const contentW = size.width - pad[1] - pad[3]
  const contentH = size.height - pad[0] - pad[2]
  const horizontal = node.layout === 'horizontal' || node.layout === 'wrap'
  const vertical = node.layout === 'vertical' || node.layout === 'wrap'
  const primary = node.primaryAxisAlignItems ?? 'MIN'
  const counter = node.counterAxisAlignItems ?? 'MIN'
  const gap = node.gap ?? 0

  const plans: ChildPlan[] = children.map((child) => ({
    child,
    abs: (child.layoutPositioning ?? 'AUTO') === 'ABSOLUTE',
    base: measureTree(child, contentW, contentH),
    pMain: 0,
    pCross: 0,
    relX: 0,
    relY: 0
  }))
  const flow = plans.filter((p) => !p.abs)

  // 主轴尺寸：fill 子均分剩余（hug 容器无剩余 → fill 不拉伸，flexbox 标准）
  const fixedTotal = flow.reduce(
    (m, p) => m + (horizontal ? (isFill(p.child.width) ? 0 : p.base.width) : isFill(p.child.height) ? 0 : p.base.height),
    0
  )
  const fillCount = flow.filter((p) => isFill(horizontal ? p.child.width : p.child.height)).length
  const available = horizontal ? contentW : contentH
  const fillUnit =
    fillCount > 0 && available !== Infinity
      ? Math.max(0, (available - fixedTotal - gap * Math.max(flow.length - 1, 0)) / fillCount)
      : 0
  for (const p of flow) {
    p.pMain = horizontal
      ? isFill(p.child.width)
        ? fillUnit
        : p.base.width
      : isFill(p.child.height)
        ? fillUnit
        : p.base.height
  }

  // 交叉轴尺寸：fill 子拉伸到内容区（hug 容器也由 measure 得到确定值，不再失效）
  const crossAvailable = horizontal ? contentH : contentW
  for (const p of flow) {
    p.pCross = horizontal
      ? isFill(p.child.height)
        ? crossAvailable
        : p.base.height
      : isFill(p.child.width)
        ? crossAvailable
        : p.base.width
  }

  if (node.layout === 'horizontal' || node.layout === 'vertical') {
    // 主轴排布
    const totalPrimary = flow.reduce((m, p) => m + p.pMain, 0)
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
    let cursor = mainStart
    for (const p of flow) {
      if (horizontal) p.relX = cursor
      else p.relY = cursor
      cursor += p.pMain + mainStep
    }

    // 交叉轴对齐（hug 容器交叉轴尺寸由 measure 确定，CENTER/MAX 可靠生效）
    for (const p of flow) {
      const freeCross = Math.max(0, crossAvailable - p.pCross)
      let offset = 0
      if (counter === 'CENTER') offset = freeCross / 2
      else if (counter === 'MAX') offset = freeCross
      if (horizontal) p.relY = offset
      else p.relX = offset
    }
  } else {
    // wrap 换行栅格（保留原逻辑；行内交叉轴对齐列为后续）
    const mainLimit = (horizontal ? contentW : contentH) ?? Infinity
    let cursor = 0
    let crossCursor = 0
    let lineMax = 0
    for (const p of flow) {
      const mainSize = p.pMain
      const crossSize = p.pCross
      if (cursor + mainSize > mainLimit && cursor > 0) {
        cursor = 0
        crossCursor += lineMax + gap
        lineMax = 0
      }
      if (horizontal) {
        p.relX = cursor
        p.relY = crossCursor
      } else {
        p.relY = cursor
        p.relX = crossCursor
      }
      cursor += mainSize + gap
      lineMax = Math.max(lineMax, crossSize)
    }
    // 重算真实组尺寸（换行结果可能大于 measure 的单行近似）
    let wmax = 0
    let hmax = 0
    for (const p of flow) {
      wmax = Math.max(wmax, p.relX + p.pMain)
      hmax = Math.max(hmax, p.relY + p.pCross)
    }
    for (const p of plans) {
      if (!p.abs) continue
      wmax = Math.max(wmax, (p.child.x ?? 0) + p.base.width)
      hmax = Math.max(hmax, (p.child.y ?? 0) + p.base.height)
    }
    result.width = wmax + pad[1] + pad[3]
    result.height = hmax + pad[0] + pad[2]
  }

  // 递归 arrange 子节点，写回排布确定的最终尺寸（子节点坐标相对本盒）
  for (const p of plans) {
    const childX = p.abs ? pad[3] + (p.child.x ?? 0) : pad[3] + p.relX
    const childY = p.abs ? pad[0] + (p.child.y ?? 0) : pad[0] + p.relY
    const c = arrangeTree(p.child, contentW, contentH, childX, childY)
    // 写回排布尺寸时按方向取主轴 / 交叉轴：horizontal/wrap 主轴=宽、vertical 主轴=高，
    // 旧实现固定 width=pMain 会把 vertical 组内子节点宽高写反（宽高交换，渲染错位 + 几何错误）
    if (!p.abs) {
      if (horizontal) {
        c.width = p.pMain
        c.height = p.pCross
      } else {
        c.width = p.pCross
        c.height = p.pMain
      }
    }
    result.children.push(c)
  }
  return result
}

/** 布局整张画布：返回根图层（根节点坐标 = 相对画布的绝对坐标；子节点相对父盒） */
export const layoutCanvasDoc = (doc: CanvasDoc): CanvasLayoutNode[] => {
  return (doc.nodes ?? []).map((node) => arrangeTree(node, doc.width, doc.height, node.x ?? 0, node.y ?? 0))
}

// ── 渲染后绝对包围盒（供 AI 核对几何，与预览/导出共用同一布局事实源） ──────

/** 单个节点渲染后的画布绝对包围盒（布局引擎解析后的真实几何） */
export interface CanvasNodeBounds {
  id: string
  name?: string
  type: CanvasNodeType
  /** 画布绝对坐标（左上角） */
  x: number
  y: number
  /** 渲染后具体像素（fill / hug 已解析为数值） */
  width: number
  height: number
  /** 包围盒中心（画布绝对坐标） */
  centerX: number
  centerY: number
  parentId?: string
  /** 层级深度：0 = 根图层 */
  depth: number
  rotation?: number
  visible?: boolean
  /** 仅 text 节点 */
  text?: string
}

/**
 * 计算画布内节点渲染后的绝对包围盒（平铺列表，DFS 先序）。
 * - 布局组内子节点的最终位置 / 尺寸由布局引擎决定，原始节点上的 x/y/width/height
 *   可能是缺省或 fill/hug 关键字，不能直接用于几何判断；本函数返回解析后的真实几何。
 * - ids 缺省返回全部；指定时只返回命中的节点（用于查看几个元素的相对位置 / 间距 / 对齐）。
 */
export const computeLayoutBounds = (doc: CanvasDoc, ids?: string[]): CanvasNodeBounds[] => {
  const roots = layoutCanvasDoc(doc)
  const out: CanvasNodeBounds[] = []
  const idSet = ids?.length ? new Set(ids) : null
  // layout 树坐标是「相对父盒」（根为画布绝对），沿父链累加得到画布绝对坐标
  const walk = (
    layout: CanvasLayoutNode,
    parentAbsX: number,
    parentAbsY: number,
    parentId: string | undefined,
    depth: number
  ): void => {
    const { node } = layout
    const absX = parentAbsX + layout.x
    const absY = parentAbsY + layout.y
    if (!idSet || idSet.has(node.id)) {
      out.push({
        id: node.id,
        name: node.name,
        type: node.type,
        x: absX,
        y: absY,
        width: layout.width,
        height: layout.height,
        centerX: absX + layout.width / 2,
        centerY: absY + layout.height / 2,
        parentId,
        depth,
        rotation: node.rotation,
        visible: node.visible,
        ...(node.type === 'text' ? { text: node.text } : {})
      })
    }
    for (const child of layout.children) walk(child, absX, absY, node.id, depth + 1)
  }
  for (const root of roots) walk(root, 0, 0, undefined, 0)
  return out
}
