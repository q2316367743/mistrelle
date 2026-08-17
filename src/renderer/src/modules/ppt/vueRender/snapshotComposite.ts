/**
 * 复合节点快照采集（Table / Timeline / Flow / Tree / Matrix / Pyramid / ProcessArrow）：
 * 几何取组件渲染后的 DOM（结构元素按 class 约定查询），样式语义取节点 attr。
 * 与 vueRender 组件同文件族共同演进——组件内部结构变化需同步此处查询选择器。
 */
import type { SlideNode } from '../pptTypes'
import { attrNum, resolveColor, toHex } from './attrStyle'
import type { LocalRect } from './overlayLinks'
import {
  elOf,
  emitDecoration,
  pushTextItem,
  rectOf,
  rectOfEl,
  svgLinesOf,
  textVisual,
  type SnapshotContext
} from './snapshotContext'

// ── Table：单元格 rect + 文本 ─────────────────────────────

export const emitTable = (ctx: SnapshotContext, node: SlideNode): void => {
  const rect = rectOf(ctx, node)
  if (!rect) return
  emitDecoration(ctx, node, rect)
  const cellColor = resolveColor(node.attr['cellBorder.color'], ctx.theme)
  const cellWidth = attrNum(node.attr, 'cellBorder.width', 1)
  const walkRow = (rows: SlideNode[]): void => {
    for (const tr of rows) {
      if (tr.tag !== 'Tr' || !Array.isArray(tr.child)) continue
      for (const td of tr.child) {
        if (td.tag !== 'Td') continue
        const el = elOf(ctx, td)
        const cellRect = rectOfEl(ctx, el)
        if (!cellRect) continue
        ctx.items.push({
          kind: 'rect',
          x: cellRect.x,
          y: cellRect.y,
          w: cellRect.w,
          h: cellRect.h,
          fill: td.attr.backgroundColor
            ? { color: toHex(resolveColor(td.attr.backgroundColor, ctx.theme) ?? '#FFFFFF') }
            : undefined,
          stroke: cellColor ? { color: toHex(cellColor), width: cellWidth } : undefined,
          nodeId: td.id
        })
        if (typeof td.child === 'string' && td.child) {
          pushTextItem(ctx, {
            rect: cellRect,
            text: td.child,
            visual: textVisual(td.attr, ctx.theme),
            valign: 'middle',
            nodeId: td.id
          })
        }
      }
    }
  }
  walkRow(Array.isArray(node.child) ? node.child : [])
}

// ── Timeline：轨道线 + 圆点 + 日期/标题/描述文本 ──────────

export const emitTimeline = (ctx: SnapshotContext, node: SlideNode): void => {
  const rootEl = elOf(ctx, node)
  const rect = rectOfEl(ctx, rootEl)
  if (!rootEl || !rect) return
  emitDecoration(ctx, node, rect)
  // 轨道线（矩形长边方向）
  const trackEl = rootEl.querySelector('.ppt-timeline__track')
  const trackRect = rectOfEl(ctx, trackEl)
  if (trackRect && !node.attr.connectorGradient) {
    const horizontal = trackRect.w >= trackRect.h
    ctx.items.push({
      kind: 'line',
      x: Math.min(trackRect.x, trackRect.x + trackRect.w),
      y: Math.min(trackRect.y, trackRect.y + trackRect.h),
      w: trackRect.w,
      h: trackRect.h,
      x1: horizontal ? trackRect.x : trackRect.x + trackRect.w / 2,
      y1: horizontal ? trackRect.y + trackRect.h / 2 : trackRect.y,
      x2: horizontal ? trackRect.x + trackRect.w : trackRect.x + trackRect.w / 2,
      y2: horizontal ? trackRect.y + trackRect.h / 2 : trackRect.y + trackRect.h,
      color: toHex(resolveColor(node.attr.connectorColor, ctx.theme) ?? '#D1D5DB'),
      width: 2
    })
  }
  const part = (item: SlideNode, cls: string): LocalRect | null =>
    rectOfEl(ctx, elOf(ctx, item)?.querySelector(cls) ?? null)
  for (const item of Array.isArray(node.child) ? node.child : []) {
    if (item.tag !== 'TimelineItem') continue
    const color = toHex(resolveColor(item.attr.color, ctx.theme) ?? '#4472C4')
    const dotRect = part(item, '.ppt-timeline__dot')
    if (dotRect) {
      ctx.items.push({ kind: 'ellipse', ...box(dotRect), fill: { color }, nodeId: item.id })
    }
    const visual = textVisual(item.attr, ctx.theme)
    const dateRect = part(item, '.ppt-timeline__date')
    if (dateRect && item.attr.date) {
      pushTextItem(ctx, {
        rect: dateRect,
        text: item.attr.date,
        visual: { ...visual, fontSize: 13, bold: true },
        valign: 'top',
        nodeId: item.id
      })
    }
    const titleRect = part(item, '.ppt-timeline__title')
    if (titleRect && item.attr.title) {
      pushTextItem(ctx, {
        rect: titleRect,
        text: item.attr.title,
        visual: { ...visual, fontSize: 16, bold: true },
        valign: 'top',
        nodeId: item.id
      })
    }
    const descRect = part(item, '.ppt-timeline__desc')
    if (descRect && item.attr.description) {
      pushTextItem(ctx, {
        rect: descRect,
        text: item.attr.description,
        visual: { ...visual, fontSize: 13 },
        valign: 'top',
        nodeId: item.id
      })
    }
  }
}

const box = (rect: LocalRect): { x: number; y: number; w: number; h: number } => ({
  x: rect.x,
  y: rect.y,
  w: rect.w,
  h: rect.h
})

// ── Flow：节点形状 + 文本 + 连线（svg line 读取） ─────────

export const emitFlow = (ctx: SnapshotContext, node: SlideNode): void => {
  const rootEl = elOf(ctx, node)
  const rect = rectOfEl(ctx, rootEl)
  if (!rootEl || !rect) return
  emitDecoration(ctx, node, rect)
  for (const child of Array.isArray(node.child) ? node.child : []) {
    if (child.tag !== 'FlowNode') continue
    const nodeRect = rectOf(ctx, child)
    if (!nodeRect) continue
    const fill = { color: toHex(resolveColor(child.attr.color, ctx.theme) ?? '#4472C4') }
    const shape = child.attr.shape
    if (shape === 'flowChartDecision') {
      ctx.items.push({
        kind: 'shape',
        ...box(nodeRect),
        shapeType: 'diamond',
        fill,
        nodeId: child.id
      })
    } else {
      ctx.items.push({
        kind: 'rect',
        ...box(nodeRect),
        fill,
        radius:
          shape === 'flowChartTerminator'
            ? Math.min(nodeRect.h / 2, 24)
            : 6,
        nodeId: child.id
      })
    }
    if (child.attr.text) {
      pushTextItem(ctx, {
        rect: nodeRect,
        text: child.attr.text,
        visual: {
          ...textVisual({}, ctx.theme),
          fontSize: 13,
          color: toHex(resolveColor(child.attr.textColor, ctx.theme) ?? '#FFFFFF')
        },
        valign: 'middle',
        nodeId: child.id
      })
    }
  }
  pushSvgLinesAsItems(ctx, rootEl, node)
}

// ── Tree：节点形状 + 文本 + 连线 ─────────────────────────

export const emitTree = (ctx: SnapshotContext, node: SlideNode): void => {
  const rootEl = elOf(ctx, node)
  const rect = rectOfEl(ctx, rootEl)
  if (!rootEl || !rect) return
  emitDecoration(ctx, node, rect)
  const shape = node.attr.nodeShape ?? 'roundRect'
  const walk = (items: SlideNode[]): void => {
    for (const item of items) {
      if (item.tag !== 'TreeItem') continue
      const itemRect = rectOf(ctx, item)
      if (itemRect) {
        ctx.items.push({
          kind: shape === 'ellipse' ? 'ellipse' : 'rect',
          ...box(itemRect),
          fill: { color: toHex(resolveColor(item.attr.color, ctx.theme) ?? '#4472C4') },
          radius: shape === 'roundRect' ? 8 : undefined,
          nodeId: item.id
        })
        pushTextItem(ctx, {
          rect: itemRect,
          text: item.attr.label,
          visual: {
            ...textVisual({}, ctx.theme),
            fontSize: 13,
            color: toHex(resolveColor(item.attr.textColor, ctx.theme) ?? resolveColor(node.attr.textColor, ctx.theme) ?? '#FFFFFF')
          },
          valign: 'middle',
          nodeId: item.id
        })
      }
      if (Array.isArray(item.child)) walk(item.child)
    }
  }
  walk(Array.isArray(node.child) ? node.child : [])
  pushSvgLinesAsItems(ctx, rootEl, node)
}

/** svg 连线 → line 快照项（Flow / Tree 共用；标签文本一并读取） */
const pushSvgLinesAsItems = (ctx: SnapshotContext, rootEl: Element, node: SlideNode): void => {
  rootEl.querySelectorAll('svg g[data-node-id]').forEach((group) => {
    const nodeId = group.getAttribute('data-node-id') ?? undefined
    for (const line of svgLinesOf(group)) {
      ctx.items.push({
        kind: 'line',
        x: Math.min(line.x1, line.x2),
        y: Math.min(line.y1, line.y2),
        w: Math.abs(line.x2 - line.x1),
        h: Math.abs(line.y2 - line.y1),
        x1: line.x1,
        y1: line.y1,
        x2: line.x2,
        y2: line.y2,
        color: line.color,
        width: line.width,
        endArrow: 'triangle',
        nodeId: nodeId ?? node.id
      })
    }
    const label = group.querySelector('text')
    if (label?.textContent) {
      const lr = rectOfEl(ctx, label)
      if (lr) {
        pushTextItem(ctx, {
          rect: lr,
          text: label.textContent,
          visual: { ...textVisual({}, ctx.theme), fontSize: 11 },
          valign: 'top',
          nodeId
        })
      }
    }
  })
}

// ── Matrix：网格框 + 轴标签 + 象限标签 + 散点 ─────────────

export const emitMatrix = (ctx: SnapshotContext, node: SlideNode): void => {
  const rootEl = elOf(ctx, node)
  const rect = rectOfEl(ctx, rootEl)
  if (!rootEl || !rect) return
  emitDecoration(ctx, node, rect)
  const gridEl = rootEl.querySelector('.ppt-matrix__grid')
  const gridRect = rectOfEl(ctx, gridEl)
  if (gridRect) {
    ctx.items.push({
      kind: 'rect',
      ...box(gridRect),
      stroke: { color: '#D1D5DB', width: 1 }
    })
  }
  const textOf = (el: Element | null, fontSize: number, bold = false): void => {
    if (!el?.textContent) return
    const r = rectOfEl(ctx, el)
    if (!r) return
    pushTextItem(ctx, {
      rect: r,
      text: el.textContent,
      visual: {
        ...textVisual({}, ctx.theme),
        fontSize,
        bold,
        color: toHex(resolveColor(node.attr.axisLabelColor, ctx.theme) ?? '#6B7280')
      },
      valign: 'top'
    })
  }
  rootEl.querySelectorAll('.ppt-matrix__axis').forEach((el) => textOf(el, 12))
  rootEl.querySelectorAll('.ppt-matrix__quad').forEach((el) => textOf(el, 13, true))
  for (const child of Array.isArray(node.child) ? node.child : []) {
    if (child.tag !== 'MatrixItem') continue
    const itemEl = elOf(ctx, child)
    const dotRect = rectOfEl(ctx, itemEl?.querySelector('.ppt-matrix__dot') ?? null)
    if (dotRect) {
      ctx.items.push({
        kind: 'ellipse',
        ...box(dotRect),
        fill: { color: toHex(resolveColor(child.attr.color, ctx.theme) ?? '#4472C4') },
        nodeId: child.id
      })
    }
    const labelRect = rectOfEl(ctx, itemEl?.querySelector('.ppt-matrix__label') ?? null)
    if (labelRect && child.attr.label) {
      pushTextItem(ctx, {
        rect: labelRect,
        text: child.attr.label,
        visual: {
          ...textVisual({}, ctx.theme),
          fontSize: 13,
          color: toHex(resolveColor(child.attr.textColor, ctx.theme) ?? '#1F2937')
        },
        valign: 'top',
        nodeId: child.id
      })
    }
  }
}

// ── Pyramid：层级梯形（SVG polygon 图片化）+ 文本 ─────────

export const emitPyramid = (ctx: SnapshotContext, node: SlideNode): void => {
  const rect = rectOf(ctx, node)
  if (!rect) return
  emitDecoration(ctx, node, rect)
  const levels = (Array.isArray(node.child) ? node.child : []).filter(
    (c) => c.tag === 'PyramidLevel'
  )
  const total = levels.length || 1
  const down = node.attr.direction === 'down'
  levels.forEach((level, index) => {
    const levelRect = rectOf(ctx, level)
    if (!levelRect) return
    const topRatio = index / total
    const bottomRatio = (index + 1) / total
    const topW = down ? 1 - bottomRatio : topRatio
    const botW = down ? 1 - topRatio : bottomRatio
    const color = toHex(resolveColor(level.attr.color, ctx.theme) ?? '#4472C4')
    // 梯形顶点（相对层级盒子自身坐标系，1:1 像素）
    const xAt = (ratio: number, side: 'l' | 'r'): number =>
      (side === 'l' ? (1 - ratio) / 2 : (1 + ratio) / 2) * levelRect.w
    const points = [
      `${xAt(topW, 'l')},0`,
      `${xAt(topW, 'r')},0`,
      `${xAt(botW, 'r')},${levelRect.h}`,
      `${xAt(botW, 'l')},${levelRect.h}`
    ].join(' ')
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(levelRect.w)}" ` +
      `height="${Math.round(levelRect.h)}"><polygon points="${points}" fill="${color}"/></svg>`
    ctx.items.push({
      kind: 'image',
      ...box(levelRect),
      src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      nodeId: level.id
    })
    if (level.attr.label) {
      pushTextItem(ctx, {
        rect: levelRect,
        text: level.attr.label,
        visual: {
          ...textVisual(node.attr, ctx.theme),
          fontSize: attrNum(node.attr, 'fontSize', 14),
          color: toHex(resolveColor(level.attr.textColor, ctx.theme) ?? '#FFFFFF')
        },
        valign: 'middle',
        nodeId: level.id
      })
    }
  })
}

// ── ProcessArrow：homePlate / chevron 形状 + 文本 ─────────

export const emitProcessArrow = (ctx: SnapshotContext, node: SlideNode): void => {
  const rect = rectOf(ctx, node)
  if (!rect) return
  emitDecoration(ctx, node, rect)
  const vertical = node.attr.direction === 'vertical'
  const steps = (Array.isArray(node.child) ? node.child : []).filter(
    (c) => c.tag === 'ProcessArrowStep'
  )
  steps.forEach((step, index) => {
    const stepRect = rectOf(ctx, step)
    if (!stepRect) return
    ctx.items.push({
      kind: 'shape',
      ...box(stepRect),
      shapeType: index === 0 ? 'homePlate' : 'chevron',
      rotate: vertical ? 90 : undefined,
      fill: { color: toHex(resolveColor(step.attr.color, ctx.theme) ?? '#4472C4') },
      nodeId: step.id
    })
    if (step.attr.label) {
      pushTextItem(ctx, {
        rect: stepRect,
        text: step.attr.label,
        visual: {
          ...textVisual({}, ctx.theme),
          fontSize: attrNum(node.attr, 'fontSize', 14),
          bold: node.attr.bold === 'true',
          color: toHex(resolveColor(step.attr.textColor, ctx.theme) ?? '#FFFFFF')
        },
        valign: 'middle',
        nodeId: step.id
      })
    }
  })
}

export type CompositeEmitter = (ctx: SnapshotContext, node: SlideNode) => void

/** 复合 tag → 采集器表 */
export const COMPOSITE_EMITTERS: Record<string, CompositeEmitter> = {
  Table: emitTable,
  Timeline: emitTimeline,
  Flow: emitFlow,
  Tree: emitTree,
  Matrix: emitMatrix,
  Pyramid: emitPyramid,
  ProcessArrow: emitProcessArrow
}
