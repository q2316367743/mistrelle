/**
 * 遮盖网格与区域几何（纯函数）：弹窗编辑、画布叠加层、main 覆盖贴回三处共用同一套网格与区域形状。
 * - 网格步长 = 图宽 / round(图宽 / 块边长)：预览的像素块与落盘贴回的块对齐。
 * - 区域一律以「轮廓点」表示（图片像素坐标，左上原点，扁平 [x1,y1,x2,y2,...]）：
 *   矩形 4 点 / OCR 文字四点四边形 / 涂抹的网格对齐矩形，渲染统一按多边形裁剪。
 */
import {
  MOSAIC_BLUR_PX,
  MOSAIC_BLUR_RANGE,
  MOSAIC_CELL_PX,
  MOSAIC_CELL_RANGE
} from '@common/types/mosaic'
import type { ImageCoverStyle } from '@common/types/mosaic'

/** 遮盖矩形：图片像素坐标（左上原点，与 ocr_image / image_mosaic 同系） */
export interface MosaicRect {
  x: number
  y: number
  w: number
  h: number
}

/** 网格：cols/rows 为格数，cellW/cellH 为实际步长（图片像素，含取整误差补偿） */
export interface MosaicGrid {
  cols: number
  rows: number
  cellW: number
  cellH: number
}

/** 已填默认值并钳制到合法范围的遮盖参数 */
export interface MosaicCoverParams {
  style: ImageCoverStyle
  /** 马赛克像素块边长（px，越小越细腻） */
  cellPx: number
  /** 毛玻璃模糊半径（px） */
  blurPx: number
}

const clamp = (value: number, [min, max]: readonly [number, number]): number =>
  Math.min(max, Math.max(min, value))

const normNumber = (
  value: number | undefined,
  fallback: number,
  range: readonly [number, number]
): number => clamp(typeof value === 'number' && Number.isFinite(value) ? value : fallback, range)

/** 遮盖参数归一化：缺省 / 越界 / 脏数据一律回落到默认值与合法范围 */
export const resolveCover = (
  cover?: { style?: ImageCoverStyle; cellPx?: number; blurPx?: number } | null
): MosaicCoverParams => ({
  style: cover?.style === 'blur' ? 'blur' : 'mosaic',
  cellPx: normNumber(cover?.cellPx, MOSAIC_CELL_PX, MOSAIC_CELL_RANGE),
  blurPx: normNumber(cover?.blurPx, MOSAIC_BLUR_PX, MOSAIC_BLUR_RANGE)
})

/** 建立图片像素网格（cellPx 为块边长目标值，实际步长按取整后的格数回算） */
export const createGrid = (width: number, height: number, cellPx: number): MosaicGrid => {
  const cell = Math.max(1, cellPx)
  const cols = Math.max(1, Math.round(width / cell))
  const rows = Math.max(1, Math.round(height / cell))
  return { cols, rows, cellW: width / cols, cellH: height / rows }
}

/** cell 键（列:行） */
const cellKey = (col: number, row: number): string => `${col}:${row}`

/** 圆覆盖到的 cell 键（图片外的丢弃；按 cell 中心点是否落在圆内判定） */
const circleCellKeys = (
  x: number,
  y: number,
  radius: number,
  grid: MosaicGrid
): string[] => {
  const { cols, rows, cellW, cellH } = grid
  const keys: string[] = []
  const c0 = Math.floor((x - radius) / cellW)
  const c1 = Math.floor((x + radius) / cellW)
  const r0 = Math.floor((y - radius) / cellH)
  const r1 = Math.floor((y + radius) / cellH)
  for (let c = Math.max(0, c0); c <= Math.min(cols - 1, c1); c++) {
    for (let r = Math.max(0, r0); r <= Math.min(rows - 1, r1); r++) {
      const dx = (c + 0.5) * cellW - x
      const dy = (r + 0.5) * cellH - y
      if (dx * dx + dy * dy > radius * radius) continue
      keys.push(cellKey(c, r))
    }
  }
  return keys
}

/** 涂抹：把圆覆盖到的 cell 加入集合，返回本次新增键（供撤销栈记录） */
export const collectCircleCells = (
  cells: Set<string>,
  x: number,
  y: number,
  radius: number,
  grid: MosaicGrid
): string[] => {
  const added: string[] = []
  for (const key of circleCellKeys(x, y, radius, grid)) {
    if (cells.has(key)) continue
    cells.add(key)
    added.push(key)
  }
  return added
}

/** 擦除：把圆覆盖到的 cell 从集合移除，返回本次删除键（供撤销栈恢复） */
export const eraseCircleCells = (
  cells: Set<string>,
  x: number,
  y: number,
  radius: number,
  grid: MosaicGrid
): string[] => {
  const removed: string[] = []
  for (const key of circleCellKeys(x, y, radius, grid)) {
    if (cells.delete(key)) removed.push(key)
  }
  return removed
}

/** cell 集合 → 行段矩形（图片像素坐标）：同行连续 cell 合并，减少区域数量 */
export const cellsToRegions = (cells: Set<string>, grid: MosaicGrid): MosaicRect[] => {
  const byRow = new Map<number, number[]>()
  for (const key of cells) {
    const [col, row] = key.split(':').map(Number)
    const list = byRow.get(row)
    if (list) list.push(col)
    else byRow.set(row, [col])
  }
  const regions: MosaicRect[] = []
  for (const [row, cols] of byRow) {
    cols.sort((a, b) => a - b)
    let start = cols[0]
    let prev = cols[0]
    const flush = () => {
      regions.push({
        x: start * grid.cellW,
        y: row * grid.cellH,
        w: (prev - start + 1) * grid.cellW,
        h: grid.cellH
      })
    }
    for (let i = 1; i < cols.length; i++) {
      if (cols[i] === prev + 1) {
        prev = cols[i]
        continue
      }
      flush()
      start = cols[i]
      prev = cols[i]
    }
    flush()
  }
  return regions
}

/** 矩形相交（框选命中判定） */
export const rectsIntersect = (a: MosaicRect, b: MosaicRect): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

/** 点是否落在矩形内（文字框点选判定） */
export const rectContains = (rect: MosaicRect, x: number, y: number): boolean =>
  x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h

/** 矩形 → 轮廓点（4 点） */
export const rectToPoints = (rect: MosaicRect): number[] => [
  rect.x,
  rect.y,
  rect.x + rect.w,
  rect.y,
  rect.x + rect.w,
  rect.y + rect.h,
  rect.x,
  rect.y + rect.h
]

/** 轮廓点 → 包围盒（点选 / 回填匹配 / 回填 cell 用；点数不足返回零矩形） */
export const pointsBounds = (points: number[]): MosaicRect => {
  if (points.length < 2) return { x: 0, y: 0, w: 0, h: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i + 1 < points.length; i += 2) {
    minX = Math.min(minX, points[i])
    maxX = Math.max(maxX, points[i])
    minY = Math.min(minY, points[i + 1])
    maxY = Math.max(maxY, points[i + 1])
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/** 轮廓点覆盖到的 cell 键（涂抹区域回填：按格中心点是否落在轮廓包围盒内判定） */
export const pointsToCells = (points: number[], grid: MosaicGrid): string[] => {
  const box = pointsBounds(points)
  if (box.w <= 0 || box.h <= 0) return []
  const keys: string[] = []
  const c0 = Math.max(0, Math.floor(box.x / grid.cellW))
  const c1 = Math.min(grid.cols - 1, Math.ceil((box.x + box.w) / grid.cellW) - 1)
  const r0 = Math.max(0, Math.floor(box.y / grid.cellH))
  const r1 = Math.min(grid.rows - 1, Math.ceil((box.y + box.h) / grid.cellH) - 1)
  for (let c = c0; c <= c1; c++) {
    for (let r = r0; r <= r1; r++) {
      const cx = (c + 0.5) * grid.cellW
      const cy = (r + 0.5) * grid.cellH
      if (cx < box.x || cx > box.x + box.w || cy < box.y || cy > box.y + box.h) continue
      keys.push(cellKey(c, r))
    }
  }
  return keys
}
