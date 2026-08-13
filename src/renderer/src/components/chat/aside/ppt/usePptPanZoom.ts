import { computed, ref } from 'vue'

const MIN_SCALE = 0.5
const MAX_SCALE = 5
const WHEEL_STEP = 1.1

/**
 * PPT 主内容视口交互：滚轮围绕指针缩放 + 拖拽平移。
 * 状态为纯 CSS transform（translate + scale），不依赖外部库。
 * 数学约定：图片经 flex 居中初始位于视口中心，transform-origin: center，
 * 故 `translate(tx, ty)` 即图片中心相对视口中心的偏移。
 */
export const usePptPanZoom = () => {
  const viewportRef = ref<HTMLElement | null>(null)
  const scale = ref(1)
  const tx = ref(0)
  const ty = ref(0)
  const isDragging = ref(false)

  /** 拖拽起点：指针屏幕坐标 + 起拖时位移（指针 capture 期间以此基准累加） */
  const dragStart = ref<{ x: number; y: number; tx: number; ty: number } | null>(null)

  const isScaled = computed(() => scale.value !== 1 || tx.value !== 0 || ty.value !== 0)
  const scalePercent = computed(() => `${Math.round(scale.value * 100)}%`)
  const transformStyle = computed(() => `translate(${tx.value}px, ${ty.value}px) scale(${scale.value})`)

  const reset = () => {
    scale.value = 1
    tx.value = 0
    ty.value = 0
  }

  /**
   * 滚轮缩放：围绕鼠标指针（指针下的内容缩放前后位置不变）。
   * 设指针相对视口中心偏移 d、当前位移 t，内容锚点 q = (d - t) / s，
   * 缩放后需满足 d = t' + q·s'，故 t' = d - (d - t)·(s'/s)。
   */
  const handleWheel = (e: WheelEvent) => {
    e.preventDefault()
    const viewport = viewportRef.value
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    const dx = e.clientX - rect.left - rect.width / 2
    const dy = e.clientY - rect.top - rect.height / 2
    const next = Math.min(
      MAX_SCALE,
      Math.max(MIN_SCALE, scale.value * (e.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP))
    )
    if (next === scale.value) return
    const ratio = next / scale.value
    tx.value = dx - (dx - tx.value) * ratio
    ty.value = dy - (dy - ty.value) * ratio
    scale.value = next
  }

  const handlePointerDown = (e: PointerEvent) => {
    dragStart.value = { x: e.clientX, y: e.clientY, tx: tx.value, ty: ty.value }
    isDragging.value = true
    // capture 后指针移出视口仍持续派发 move/up 到本元素，保证拖拽不中断
    viewportRef.value?.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: PointerEvent) => {
    const start = dragStart.value
    if (!start) return
    tx.value = start.tx + (e.clientX - start.x)
    ty.value = start.ty + (e.clientY - start.y)
  }

  const handlePointerUp = (e: PointerEvent) => {
    dragStart.value = null
    isDragging.value = false
    if (viewportRef.value?.hasPointerCapture(e.pointerId)) {
      viewportRef.value.releasePointerCapture(e.pointerId)
    }
  }

  return {
    viewportRef,
    isDragging,
    isScaled,
    scalePercent,
    transformStyle,
    reset,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp
  }
}
