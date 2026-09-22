/**
 * 马赛克弹窗编辑器：编辑发生在弹窗内的普通 canvas 上，坐标只有两层——图片像素 ↔ 显示像素
 * （scale = 显示宽 / 图片实际宽）。预览与画布叠加层共用同一套绘制原语（同网格 / 同模糊半径），
 * 标记只累积在内存，点「应用」才写入画布节点的 `mosaic` 字段（非破坏：原图不变，随时可复原）。
 */
import {
  MOSAIC_BLUR_RANGE,
  MOSAIC_CELL_RANGE,
  MOSAIC_BLUR_PX,
  MOSAIC_CELL_PX
} from '@common/types/mosaic'
import type { ImageCoverStyle } from '@common/types/mosaic'
import { MessageUtil } from '@/utils/modal'
import {
  applyNodeMosaic,
  clearNodeMosaic,
  createGrid,
  createPixelatedSmall,
  resolveCover
} from '@/windows/main/modules/canvas'
import type { CanvasMosaic, MosaicCoverParams, MosaicGrid } from '@/windows/main/modules/canvas'
import { useMosaicMarks } from './mosaicMarks'
import { fitDisplay, paintOverlay, paintStage, prepareCanvas } from './mosaicPreview'
import type { MosaicPalette } from './mosaicPreview'

export type MosaicEditMode = 'auto' | 'brush'

interface UseMosaicEditorOptions {
  /** 源图本地绝对路径（画布 image 节点的 imageUrl） */
  source: string
  sandbox: () => string
  /** 遮盖记录写回的目标画布 image 节点 id */
  nodeId: string
  /** 节点已记录的遮盖（打开即回填；无记录传 undefined） */
  initial?: CanvasMosaic
  /** 舞台元素与两层 canvas（内容组件模板 ref 的取值函数） */
  stage: () => HTMLElement | undefined
  base: () => HTMLCanvasElement | undefined
  overlay: () => HTMLCanvasElement | undefined
}

/** 画布 2D 取色走 tdesign token（跟随主题），token 缺失时回退字面值 */
const readToken = (name: string, fallback: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback

/** 笔画采样：轨迹按刷宽 1/4 插值补点，避免快速拖动漏格 */
const SAMPLE_RATIO = 4

/** 笔刷粗细 / 遮盖方式 / 强度的会话内记忆（弹窗销毁后仍保留上次选择） */
let savedBrushSize = 32
let savedStyle: ImageCoverStyle = 'mosaic'
let savedCellPx = MOSAIC_CELL_PX
let savedBlurPx = MOSAIC_BLUR_PX

export const useMosaicEditor = (options: UseMosaicEditorOptions) => {
  const mode = ref<MosaicEditMode>('auto')
  const ocrBusy = ref(true)
  const ocrFailed = ref(false)
  const applying = ref(false)
  const brushSize = ref(savedBrushSize)
  const erasing = ref(false)
  /** 遮盖方式与强度（打开已有记录时按记录回填） */
  const style = ref<ImageCoverStyle>(options.initial?.style ?? savedStyle)
  const cellPx = ref(options.initial?.cellPx ?? savedCellPx)
  const blurPx = ref(options.initial?.blurPx ?? savedBlurPx)
  watch(brushSize, (v) => {
    savedBrushSize = v
  })
  watch(style, (v) => {
    savedStyle = v
  })

  const marks = useMosaicMarks()
  const { boxes, texts, markedBoxes, markedCount, isEmpty, canUndo } = marks
  /** 悬停的文字框（图上悬停与列表悬停共用） */
  const hoveredBox = ref(-1)

  // 绘制几何（非响应式：绘制由 requestDraw 显式驱动，避免每次落笔都触发响应式链路）
  let image: HTMLImageElement | null = null
  let grid: MosaicGrid = createGrid(1, 1, cellPx.value)
  let pixelated: HTMLCanvasElement | null = null
  /** 图片像素 → 显示像素 */
  let scale = 1
  let displayW = 0
  let displayH = 0
  let rafId = 0
  let dirtyBase = false
  let dragging = false
  let dragFrom: { x: number; y: number } | null = null
  let strokeFrom: { x: number; y: number } | null = null
  let strokeKeys: string[] = []
  let strokeErase = false
  /** 最近的指针位置（显示坐标，画刷光标圈 / 框选预览） */
  let pointer: { x: number; y: number } | null = null
  let palette: MosaicPalette = {
    accent: '#e34d59',
    marked: '#2ba471',
    accentFill: 'rgba(227, 77, 89, 0.08)'
  }

  const { width: stageW, height: stageH } = useElementSize(() => options.stage())

  const contextOf = (canvas?: HTMLCanvasElement): CanvasRenderingContext2D | null =>
    canvas?.getContext('2d') ?? null

  /** 遮盖参数（当前方式 + 强度，钳制到合法范围） */
  const cover = computed<MosaicCoverParams>(() =>
    resolveCover({ style: style.value, cellPx: cellPx.value, blurPx: blurPx.value })
  )
  /** 强度滑块：马赛克=块边长（越小越细腻）/ 毛玻璃=模糊半径 */
  const strength = computed({
    get: () => (style.value === 'blur' ? blurPx.value : cellPx.value),
    set: (value: number) => {
      if (style.value === 'blur') blurPx.value = value
      else cellPx.value = value
    }
  })
  const strengthRange = computed(() =>
    style.value === 'blur'
      ? { min: MOSAIC_BLUR_RANGE[0], max: MOSAIC_BLUR_RANGE[1], step: 1 }
      : { min: MOSAIC_CELL_RANGE[0], max: MOSAIC_CELL_RANGE[1], step: 2 }
  )
  /** 节点是否已有记录：决定「无标记时应用」是否可用（= 复原） */
  const hasRecord = ref((options.initial?.regions?.length ?? 0) > 0)
  const canApply = computed(() => !isEmpty.value || hasRecord.value)
  /** 当前全部遮盖区域（图片像素坐标） */
  const markedRegions = () => marks.markedRegions(grid)

  // ── 绘制（rAF 节流；底层仅在有变化时重绘） ────────────────

  const drawBase = () => {
    const canvas = options.base()
    const ctx = contextOf(canvas)
    if (!canvas || !ctx || !image) return
    prepareCanvas(canvas, ctx, displayW, displayH)
    paintStage(ctx, {
      image,
      paths: markedRegions().map((region) => region.points),
      cover: cover.value,
      grid,
      pixelated,
      width: displayW,
      height: displayH
    })
  }

  const drawOverlay = () => {
    const canvas = options.overlay()
    const ctx = contextOf(canvas)
    if (!canvas || !ctx) return
    prepareCanvas(canvas, ctx, displayW, displayH)
    paintOverlay(ctx, palette, {
      mode: mode.value,
      boxes: boxes.value,
      marked: markedBoxes.value,
      hovered: hoveredBox.value,
      drag: dragging && dragFrom && pointer ? dragRect(dragFrom, pointer) : null,
      pointer,
      brushSize: brushSize.value,
      erasing: erasing.value,
      scale,
      width: displayW,
      height: displayH
    })
  }

  const requestDraw = (base = false) => {
    if (base) dirtyBase = true
    if (rafId) return
    rafId = requestAnimationFrame(() => {
      rafId = 0
      if (dirtyBase) {
        dirtyBase = false
        drawBase()
      }
      drawOverlay()
    })
  }

  /** 重新适配舞台（contain、上限 2×）+ 重建像素化小图缓存 */
  const rebuild = () => {
    if (!image || !image.naturalWidth) return
    const fit = fitDisplay(
      image.naturalWidth,
      image.naturalHeight,
      Math.max(40, stageW.value - 16),
      Math.max(40, stageH.value - 16)
    )
    scale = fit.scale
    displayW = fit.width
    displayH = fit.height
    pixelated = createPixelatedSmall(image, grid)
    requestDraw(true)
  }

  /** 块边长变化：网格重建 + 涂抹标记按像素区域重排（遮盖范围不随块大小漂移） */
  watch(cellPx, (value) => {
    if (!image?.naturalWidth) return
    savedCellPx = value
    const next = createGrid(image.naturalWidth, image.naturalHeight, value)
    marks.requantizeCells(grid, next)
    grid = next
    pixelated = createPixelatedSmall(image, grid)
    requestDraw(true)
  })
  watch(blurPx, (value) => {
    savedBlurPx = value
    requestDraw(true)
  })
  // 切换遮盖方式：像素化 / 模糊贴片不同，底层重绘
  watch(style, () => requestDraw(true))
  // 橡皮擦开关 / 笔刷粗细只影响上层笔刷光标（描边色 / 半径）
  watch(erasing, () => requestDraw())
  watch(brushSize, () => requestDraw())

  // ── 坐标换算（显示坐标 ↔ 图片像素） ──────────────────────

  const toImage = (point: { x: number; y: number }) => ({ x: point.x / scale, y: point.y / scale })

  const localPoint = (e: PointerEvent) => ({ x: e.offsetX, y: e.offsetY })

  const dragRect = (from: { x: number; y: number }, to: { x: number; y: number }) => ({
    x: Math.min(from.x, to.x),
    y: Math.min(from.y, to.y),
    w: Math.abs(to.x - from.x),
    h: Math.abs(to.y - from.y)
  })

  // ── 指针交互 ──────────────────────────────────────────

  /** 涂抹 / 擦除一段轨迹：按网格 cell 采集（与写回同网格，故预览即所得） */
  const paintSegment = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const radius = brushSize.value / 2 / scale
    const step = Math.max(2, brushSize.value / SAMPLE_RATIO)
    const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / step))
    for (let i = 1; i <= steps; i++) {
      const p = toImage({
        x: from.x + ((to.x - from.x) * i) / steps,
        y: from.y + ((to.y - from.y) * i) / steps
      })
      strokeKeys.push(...marks.paintAt(p.x, p.y, radius, grid, strokeErase))
    }
  }

  const endStroke = () => {
    marks.pushCellsAction(strokeKeys, !strokeErase)
    strokeKeys = []
    strokeFrom = null
  }

  const handlePointerDown = (e: PointerEvent) => {
    // 图片未就绪时网格/缩放都是占位值，此期间不接受交互
    if (!image || e.button !== 0 || applying.value) return
    const point = localPoint(e)
    dragging = true
    dragFrom = point
    pointer = point
    options.overlay()?.setPointerCapture(e.pointerId)
    if (mode.value === 'brush') {
      strokeKeys = []
      strokeErase = erasing.value
      strokeFrom = point
      paintSegment(point, point)
      requestDraw(true)
      return
    }
    requestDraw()
  }

  const handlePointerMove = (e: PointerEvent) => {
    const point = localPoint(e)
    pointer = point
    if (dragging) {
      if (mode.value === 'brush') {
        paintSegment(strokeFrom ?? point, point)
        strokeFrom = point
        requestDraw(true)
        return
      }
      requestDraw()
      return
    }
    if (mode.value === 'auto') {
      setHovered(marks.pickBox(toImage(point)))
      return
    }
    requestDraw()
  }

  const handlePointerUp = (e: PointerEvent) => {
    if (!dragging) return
    dragging = false
    const point = localPoint(e)
    if (mode.value === 'brush') {
      endStroke()
      requestDraw(true)
      return
    }
    const from = dragFrom
    dragFrom = null
    if (from && Math.hypot(point.x - from.x, point.y - from.y) > 4) {
      const box = dragRect(from, point)
      const region = { x: box.x / scale, y: box.y / scale, w: box.w / scale, h: box.h / scale }
      const hits = marks.boxesInRect(region)
      if (!hits.length) MessageUtil.info('框选范围内没有识别到的文字')
      else marks.markBoxes(hits, true)
      requestDraw(true)
      return
    }
    toggleBox(marks.pickBox(toImage(point)))
  }

  const handlePointerLeave = () => {
    if (dragging) return
    pointer = null
    hoveredBox.value = -1
    requestDraw()
  }

  // ── 标记操作（列表与图上共用，必须带重绘） ────────────────

  /** 勾选 / 取消单个文字框：标记变化直接影响遮盖区域，须重绘底层（勾选即时变遮盖、取消即时还原） */
  const toggleBox = (index: number) => {
    if (marks.toggleBox(index)) requestDraw(true)
  }

  /** 悬停联动（列表 ↔ 图上描边加粗）：只重绘上层 */
  const setHovered = (index: number) => {
    if (hoveredBox.value === index) return
    hoveredBox.value = index
    requestDraw()
  }

  // ── 撤销 / 清空 / 应用 ─────────────────────────────────

  const undo = () => {
    if (marks.undo()) requestDraw(true)
  }

  const clearMarks = () => {
    marks.clear()
    requestDraw(true)
  }

  /**
   * 应用：写入节点遮盖记录（非破坏，原图不变）；标记清空后应用 = 复原（删除记录）。
   * 全程零 IPC、零文件产出，成功返回 true。
   */
  const apply = async (): Promise<boolean> => {
    if (applying.value) return false
    applying.value = true
    const sandboxDir = options.sandbox()
    try {
      const current = cover.value
      if (isEmpty.value && !hasRecord.value) return false
      const regions = markedRegions()
      if (!regions.length) {
        await clearNodeMosaic({ sandboxDir, nodeId: options.nodeId })
        hasRecord.value = false
        MessageUtil.success('已复原：移除遮盖记录')
      } else {
        await applyNodeMosaic({
          sandboxDir,
          nodeId: options.nodeId,
          regions,
          style: current.style,
          cellPx: current.cellPx,
          blurPx: current.blurPx
        })
        hasRecord.value = true
        MessageUtil.success('已应用遮盖（可随时复原）')
      }
      return true
    } catch (e) {
      MessageUtil.error('遮盖应用失败', e)
      return false
    } finally {
      applying.value = false
    }
  }

  // ── 载入与识别 ────────────────────────────────────────

  /** 离线 OCR：识别原图文字，转文字框（包围盒 + 四点轮廓）与文本列表 */
  const recognize = async () => {
    ocrBusy.value = true
    ocrFailed.value = false
    try {
      const result = await window.preload.inject.ocr.recognize(options.source)
      const lines = result.lines.filter((l) => l.w > 1 && l.h > 1)
      // 文字框下标会随新结果失效：先记下当前区域，识别后按新文字框重新匹配（涂抹 cell 本就按网格存储，不受影响）
      const previous = marks.markedRegions(grid)
      marks.setOcrLines(
        lines.map((l) => ({
          rect: { x: l.x, y: l.y, w: l.w, h: l.h },
          points: l.points,
          text: l.text
        }))
      )
      marks.restore(previous, grid)
      requestDraw(true)
    } catch (e) {
      ocrFailed.value = true
      MessageUtil.error('文字识别失败', e)
    } finally {
      ocrBusy.value = false
    }
  }

  const start = async () => {
    palette = {
      accent: readToken('--td-error-color', palette.accent),
      marked: readToken('--td-success-color', palette.marked),
      accentFill: palette.accentFill
    }
    try {
      const el = new Image()
      el.src = window.preload.net.pathToHref(options.source)
      await el.decode()
      image = el
      grid = createGrid(el.naturalWidth, el.naturalHeight, cellPx.value)
      rebuild()
    } catch (e) {
      ocrBusy.value = false
      ocrFailed.value = true
      MessageUtil.error('图片加载失败', e)
      return
    }
    // 先识别再回填：文字区域要等 OCR 文字框就绪才能匹配勾选（识别失败则退为遗留区域）
    await recognize()
    marks.restore(options.initial?.regions ?? [], grid)
    requestDraw(true)
  }

  watch([stageW, stageH], () => rebuild())
  // 切换模式：清掉交互态（指针语义随模式改变）；橡皮擦只在涂抹模式有意义
  watch(mode, (value) => {
    dragging = false
    dragFrom = null
    strokeKeys = []
    strokeFrom = null
    hoveredBox.value = -1
    if (value !== 'brush') erasing.value = false
    requestDraw(true)
  })
  onScopeDispose(() => {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
  })

  return {
    mode,
    style,
    strength,
    strengthRange,
    brushSize,
    erasing,
    ocrBusy,
    ocrFailed,
    applying,
    boxes,
    texts,
    markedBoxes,
    hoveredBox,
    markedCount,
    isEmpty,
    canUndo,
    canApply,
    start,
    recognize,
    undo,
    clearMarks,
    toggleBox,
    setHovered,
    apply,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave
  }
}
