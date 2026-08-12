import type { ComputedRef, Ref } from 'vue'
import { useBoolState } from '@/hooks/UseState'

/** 折叠态两行高度：行高（文本行高 + 垂直内边距×2 + 上下边框）×2 + 行距，随主题 token 自适应 */
const TWO_ROWS_MAX_HEIGHT =
  'calc(2 * var(--td-line-height-body-small) + 4 * var(--td-comp-paddingTB-xxs) + 4px + var(--td-comp-margin-s))'

/** 产物列表折叠行为：默认收起为两行，产物溢出两行时才展示展开/收起按钮，切换时平滑展开收起 */
export const useProductListCollapse = (products: Ref<unknown[]> | ComputedRef<unknown[]>) => {
  const [collapsed] = useBoolState(true)
  const listRef = ref<HTMLElement>()
  const isCollapsible = ref(false)
  /** 两行卡片区域精确高度（px），依据真实渲染结果测量，保证折叠后恰好两行 */
  let collapsedHeight = 0
  /** 列表 max-height：折叠态为两行高度；展开态为真实内容高度，动画结束后释放 */
  const maxHeight = ref<string>(TWO_ROWS_MAX_HEIGHT)

  function measureCollapsedHeight() {
    const el = listRef.value
    if (!el) return
    const card = el.querySelector<HTMLElement>('.product-card')
    const gap = parseFloat(getComputedStyle(el).getPropertyValue('--td-comp-margin-s')) || 0
    const row = card ? card.offsetHeight : 26
    collapsedHeight = row * 2 + gap
  }

  function checkOverflow() {
    const el = listRef.value
    if (!el) return
    isCollapsible.value = el.scrollHeight > el.clientHeight + 1
  }

  // 展开动画结束时释放 max-height，避免限制后续收起；收起时移除监听防止残留触发
  function onExpandEnd(e: TransitionEvent) {
    const el = listRef.value
    if (!el || e.propertyName !== 'max-height') return
    el.removeEventListener('transitionend', onExpandEnd)
    maxHeight.value = ''
  }

  /** 折叠/展开切换：先对齐到真实内容高度再过渡到目标高度，实现平滑展开收起 */
  function toggleProducts() {
    const el = listRef.value
    if (!el) return
    if (collapsed.value) {
      el.addEventListener('transitionend', onExpandEnd)
      maxHeight.value = `${el.scrollHeight}px`
    } else {
      el.removeEventListener('transitionend', onExpandEnd)
      maxHeight.value = `${el.scrollHeight}px`
      void el.offsetHeight
      maxHeight.value = `${collapsedHeight}px`
    }
    collapsed.value = !collapsed.value
  }

  async function refreshCollapse() {
    await nextTick()
    measureCollapsedHeight()
    maxHeight.value = `${collapsedHeight}px`
    checkOverflow()
  }

  onMounted(refreshCollapse)
  watch(products, refreshCollapse)

  return { listRef, collapsed, isCollapsible, maxHeight, toggleProducts }
}
