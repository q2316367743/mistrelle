import { useUtoolsKvStorage } from '@/hooks'
import { LocalNameEnum } from '@/global/LocalNameEnum'

/** 侧边栏宽度硬性上下限；内容区至少保底 320px，窗口缩小时按此收敛 */
const MIN_WIDTH = 180
const MAX_WIDTH = 640
const CONTENT_MIN_WIDTH = 320

/**
 * 聊天引擎右侧边栏拖拽调宽：宽度持久化到本地存储，
 * 拖动与窗口缩放都收敛到 [180, min(640, 窗口宽-320)] 区间。
 */
export const useChatAsideResize = () => {
  const width = useUtoolsKvStorage<number>(LocalNameEnum.KEY_AI_ASIDE_WIDTH, 232)

  /** 当前窗口允许的侧边栏最大宽度 */
  const maxWidthByWindow = () => Math.min(MAX_WIDTH, window.innerWidth - CONTENT_MIN_WIDTH)
  /** 把宽度收敛到 [MIN_WIDTH, 窗口上限] 区间 */
  const clampWidth = (value: number) => Math.min(maxWidthByWindow(), Math.max(MIN_WIDTH, value))

  /**
   * 拖动侧边栏左边缘调整宽度：记录拖动起点后挂全局监听，实时收敛宽度；松开时清理监听并还原光标。
   * 侧边栏位于右侧，鼠标向左移动（clientX 减小）即宽度增加。
   */
  const startResize = (e: MouseEvent) => {
    const startX = e.clientX
    const startWidth = width.value
    const onMove = (ev: MouseEvent) => {
      width.value = clampWidth(startWidth + (startX - ev.clientX))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // 窗口尺寸变化时按当前可用空间重新收敛宽度，避免侧边栏超出窗口
  const handleWindowResize = () => {
    width.value = clampWidth(width.value)
  }
  onMounted(() => window.addEventListener('resize', handleWindowResize))
  onBeforeUnmount(() => window.removeEventListener('resize', handleWindowResize))

  return { width, startResize }
}
