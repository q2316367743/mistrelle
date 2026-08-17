/**
 * 连线几何工具（Flow / Tree / Arrow 共用）：节点矩形测量、中心线裁剪到边框、
 * SVG 箭头多边形 / 虚线 dasharray 生成。坐标均为容器局部 px（相对容器左上角）。
 */

export interface LocalRect {
  x: number
  y: number
  w: number
  h: number
}

/** 元素相对容器（base 矩形）的局部矩形 */
export const localRect = (el: Element, base: DOMRect): LocalRect => {
  const r = el.getBoundingClientRect()
  return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height }
}

/** 中心线 from 中心 → to 中心，两端裁剪到各自矩形边框（返回边框交点） */
export const trimCenters = (from: LocalRect, to: LocalRect): { x1: number; y1: number; x2: number; y2: number } => {
  const fcx = from.x + from.w / 2
  const fcy = from.y + from.h / 2
  const tcx = to.x + to.w / 2
  const tcy = to.y + to.h / 2
  return {
    x1: edgePoint(from, tcx, tcy).x,
    y1: edgePoint(from, tcx, tcy).y,
    x2: edgePoint(to, fcx, fcy).x,
    y2: edgePoint(to, fcx, fcy).y
  }
}

/** 矩形中心朝目标点方向的边框交点 */
export const edgePoint = (rect: LocalRect, tx: number, ty: number): { x: number; y: number } => {
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  const dx = tx - cx
  const dy = ty - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  const scaleX = dx === 0 ? Infinity : rect.w / 2 / Math.abs(dx)
  const scaleY = dy === 0 ? Infinity : rect.h / 2 / Math.abs(dy)
  const scale = Math.min(scaleX, scaleY)
  return { x: cx + dx * scale, y: cy + dy * scale }
}

/** 虚线 attr → SVG stroke-dasharray */
export const dashArray = (dashType: string | undefined): string | undefined => {
  if (!dashType || dashType === 'solid') return undefined
  if (dashType === 'sysDot' || dashType === 'dot') return '1 5'
  if (dashType === 'dashDot') return '8 4 2 4'
  if (dashType === 'lgDash') return '14 6'
  if (dashType === 'lgDashDot') return '14 6 2 6'
  if (dashType === 'lgDashDotDot') return '14 6 2 6 2 6'
  return '6 4'
}

/** 箭头类型归一：true/常见类型名 → triangle；'none'/false → null */
export const arrowKind = (value: string | boolean | undefined): 'triangle' | 'oval' | null => {
  if (value === undefined || value === false || value === 'false' || value === 'none') return null
  if (value === 'oval' || value === 'ellipse') return 'oval'
  return 'triangle'
}

/** 三角箭头 points 串（tip 在 (x,y) 朝 angleDeg，0 = 朝右顺时针） */
export const arrowPointsStr = (x: number, y: number, angleDeg: number, size: number): string => {
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const half = size * 0.42
  const p = (dx: number, dy: number): string =>
    `${x + dx * cos - dy * sin},${y + dx * sin + dy * cos}`
  return `${p(-size, -half)} ${p(0, 0)} ${p(-size, half)}`
}

/** 箭头 SVG 片段（triangle 多边形 / oval 圆）：tip 在 (x,y)，朝向 angleDeg（0 = 朝右，顺时针） */
export const arrowSvg = (x: number, y: number, angleDeg: number, size: number, color: string, kind: 'triangle' | 'oval'): string => {
  if (kind === 'oval') {
    const rad = (angleDeg * Math.PI) / 180
    const r = size / 2.2
    return `<circle cx="${x - r * Math.cos(rad)}" cy="${y - r * Math.sin(rad)}" r="${r}" fill="${color}" />`
  }
  return `<polygon points="${arrowPointsStr(x, y, angleDeg, size)}" fill="${color}" />`
}

/** 线段角度（度，0 = 朝右，顺时针；屏幕 y 向下） */
export const segmentAngle = (x1: number, y1: number, x2: number, y2: number): number =>
  (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI
