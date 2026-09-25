/**
 * 弹窗标记模型（纯逻辑，不含绘制与指针）：OCR 文字框标记 + 涂抹网格 cell + 遗留区域。
 * 三者统一派生「遮盖区域」（图片像素坐标的轮廓点），供预览绘制与写回画布节点复用。
 * 撤销栈按「一次勾选 / 一次框选 / 一笔涂抹 / 一次擦除」各记一项。
 */
import {
  cellsToRegions,
  collectCircleCells,
  eraseCircleCells,
  pointsBounds,
  pointsToCells,
  rectContains,
  rectToPoints,
  rectsIntersect
} from '@/windows/main/modules/canvas'
import type { CanvasMosaicRegion, MosaicGrid, MosaicRect } from '@/windows/main/modules/canvas'

/** OCR 识别行（图片像素坐标）：包围盒 + 可选四点轮廓 + 文本 */
export interface MosaicOcrLine {
  rect: MosaicRect
  points?: number[]
  text: string
}

/** 撤销栈动作：文字框批量标记 / 涂抹 cell（on=false 表示擦除） */
export type MosaicMarkAction =
  | { kind: 'boxes'; indexes: number[]; on: boolean }
  | { kind: 'cells'; keys: string[]; on: boolean }

export const useMosaicMarks = () => {
  /** OCR 文字框 / 文本 / 四点轮廓（同序，图片像素坐标） */
  const boxes = ref<MosaicRect[]>([])
  const texts = ref<string[]>([])
  const quads = ref<number[][]>([])
  /** 文字框标记下标 + 涂抹 cell 键集合 */
  const markedBoxes = ref<Set<number>>(new Set())
  const brushCells = ref<Set<string>>(new Set())
  /** 回填时未能匹配到 OCR 框的历史记录区域（原样保留并写回，仅能整体清空） */
  const legacyRegions = ref<CanvasMosaicRegion[]>([])
  const history = ref<MosaicMarkAction[]>([])

  /** 涂抹 cell → 行段矩形缓存（落笔 / 网格变化 / 擦除时置空） */
  let cellsCache: MosaicRect[] | null = null

  const invalidateCells = (): void => {
    cellsCache = null
  }

  /** 文字区域轮廓：优先四点四边形（贴合倾斜文字），缺省退回包围盒 4 点 */
  const boxRegion = (index: number): CanvasMosaicRegion | null => {
    const box = boxes.value[index]
    if (!box) return null
    const quad = quads.value[index]
    return {
      points: quad && quad.length >= 6 ? [...quad] : rectToPoints(box),
      kind: 'text',
      ...(texts.value[index] ? { text: texts.value[index] } : {})
    }
  }

  /** 全部遮盖区域（图片像素坐标）：勾选文字框 + 涂抹行段 + 遗留区域 */
  const markedRegions = (grid: MosaicGrid): CanvasMosaicRegion[] => {
    const regions: CanvasMosaicRegion[] = []
    for (const index of markedBoxes.value) {
      const region = boxRegion(index)
      if (region) regions.push(region)
    }
    if (brushCells.value.size) {
      cellsCache ??= cellsToRegions(brushCells.value, grid)
      for (const rect of cellsCache) regions.push({ points: rectToPoints(rect), kind: 'brush' })
    }
    return [...regions, ...legacyRegions.value]
  }

  /** 已标记处数：勾选文字框 + 涂抹笔数（擦除项不计）+ 遗留区域 */
  const markedCount = computed(
    () =>
      markedBoxes.value.size +
      history.value.filter((a) => a.kind === 'cells' && a.on).length +
      legacyRegions.value.length
  )
  const isEmpty = computed(
    () =>
      markedBoxes.value.size === 0 &&
      brushCells.value.size === 0 &&
      legacyRegions.value.length === 0
  )
  const canUndo = computed(() => history.value.length > 0)

  // ── 文字框 ────────────────────────────────────────────

  const markBoxes = (indexes: number[], on: boolean): boolean => {
    const changed = indexes.filter((i) => markedBoxes.value.has(i) !== on)
    if (!changed.length) return false
    for (const i of changed) {
      if (on) markedBoxes.value.add(i)
      else markedBoxes.value.delete(i)
    }
    history.value.push({ kind: 'boxes', indexes: changed, on })
    return true
  }

  const toggleBox = (index: number): boolean => {
    if (index < 0 || index >= boxes.value.length) return false
    return markBoxes([index], !markedBoxes.value.has(index))
  }

  /** 命中测试：取包含该点的最小文字框（嵌套时优先小框） */
  const pickBox = (point: { x: number; y: number }): number => {
    let hit = -1
    boxes.value.forEach((box, i) => {
      if (!rectContains(box, point.x, point.y)) return
      const best = hit >= 0 ? boxes.value[hit] : null
      if (!best || box.w * box.h < best.w * best.h) hit = i
    })
    return hit
  }

  /** 框选命中的文字框下标 */
  const boxesInRect = (region: MosaicRect): number[] =>
    boxes.value
      .map((box, index) => ({ box, index }))
      .filter(({ box }) => rectsIntersect(box, region))
      .map(({ index }) => index)

  /** OCR 结果替换：文字框下标全部失效，只重置文字框标记，保留涂抹笔迹与遗留区域 */
  const setOcrLines = (lines: MosaicOcrLine[]): void => {
    boxes.value = lines.map((line) => line.rect)
    texts.value = lines.map((line) => line.text)
    quads.value = lines.map((line) => line.points ?? [])
    markedBoxes.value.clear()
    history.value = history.value.filter((a) => a.kind === 'cells')
  }

  // ── 涂抹 ──────────────────────────────────────────────

  /** 涂抹 / 擦除一个圆点，返回本次变更的 cell 键（供撤销栈记录） */
  const paintAt = (
    x: number,
    y: number,
    radius: number,
    grid: MosaicGrid,
    erase: boolean
  ): string[] => {
    const keys = erase
      ? eraseCircleCells(brushCells.value, x, y, radius, grid)
      : collectCircleCells(brushCells.value, x, y, radius, grid)
    if (keys.length) invalidateCells()
    return keys
  }

  /** 一笔结束：有变更才入撤销栈（on=false 为擦除，撤销时恢复 these cells） */
  const pushCellsAction = (keys: string[], on: boolean): void => {
    if (!keys.length) return
    history.value.push({ kind: 'cells', keys: [...keys], on })
  }

  /** 块边长变化：按「像素区域」把涂抹 cell 重排到新网格（保持遮盖范围不随网格漂移） */
  const requantizeCells = (oldGrid: MosaicGrid, newGrid: MosaicGrid): void => {
    if (!brushCells.value.size) return
    const next = new Set<string>()
    for (const rect of cellsToRegions(brushCells.value, oldGrid)) {
      for (const key of pointsToCells(rectToPoints(rect), newGrid)) next.add(key)
    }
    brushCells.value = next
    invalidateCells()
  }

  // ── 回填 / 撤销 / 清空 ────────────────────────────────

  /** 匹配 OCR 文字框：文本一致且包围盒中心落在容差内（OCR 重跑结果可能微调） */
  const matchTextBox = (region: CanvasMosaicRegion): number => {
    const bound = pointsBounds(region.points)
    const cx = bound.x + bound.w / 2
    const cy = bound.y + bound.h / 2
    const tolerance = Math.max(bound.w, bound.h, 4)
    let best = -1
    boxes.value.forEach((box, index) => {
      if (region.text && texts.value[index] !== region.text) return
      if (Math.abs(box.x + box.w / 2 - cx) > tolerance) return
      if (Math.abs(box.y + box.h / 2 - cy) > tolerance) return
      best = index
    })
    return best
  }

  /** 回填已记录的遮盖区域：涂抹还原为 cell、文字匹配 OCR 框勾选、未匹配的存为遗留区域 */
  const restore = (regions: CanvasMosaicRegion[], grid: MosaicGrid): void => {
    if (!regions.length) return
    const rest: CanvasMosaicRegion[] = []
    for (const region of regions) {
      if (region.kind === 'brush') {
        for (const key of pointsToCells(region.points, grid)) brushCells.value.add(key)
        continue
      }
      const index = matchTextBox(region)
      if (index >= 0) markedBoxes.value.add(index)
      else rest.push(region)
    }
    legacyRegions.value = rest
    invalidateCells()
  }

  const undo = (): boolean => {
    const action = history.value.pop()
    if (!action) return false
    if (action.kind === 'boxes') {
      for (const i of action.indexes) {
        if (action.on) markedBoxes.value.delete(i)
        else markedBoxes.value.add(i)
      }
    } else {
      for (const key of action.keys) {
        if (action.on) brushCells.value.delete(key)
        else brushCells.value.add(key)
      }
      invalidateCells()
    }
    return true
  }

  const clear = (): void => {
    markedBoxes.value.clear()
    brushCells.value.clear()
    legacyRegions.value = []
    history.value = []
    invalidateCells()
  }

  return {
    boxes,
    texts,
    markedBoxes,
    brushCells,
    legacyRegions,
    markedCount,
    isEmpty,
    canUndo,
    markedRegions,
    markBoxes,
    toggleBox,
    pickBox,
    boxesInRect,
    setOcrLines,
    paintAt,
    pushCellsAction,
    requantizeCells,
    restore,
    undo,
    clear
  }
}
