/**
 * PPT 主视图节点点选组合式函数：
 * - 把当前页 SVG 解析为内联 DOM（DOMParser 解析的脚本不执行，安全），经 mapSlideGroups
 *   注入 data-node-id，替换 <img> 渲染
 * - 单击节点选中（高亮框追加到 SVG 用户坐标系，随缩放平移同步）、再次点击空白取消
 * - 「引用此节点」确认 → 经 PPT_NODE_PICK_KEY 桥注入聊天输入框（无桥降级复制 nodeId）
 */
import { inject, ref, watch, type Ref } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { mapSlideGroups } from '@/modules/ppt/pptSvgMapping'
import type { SlideNode } from '@/modules/ppt/pptTypes'
import { PPT_NODE_PICK_KEY } from '@/components/chat/ppt/pptNodeBridge'
import type { PptNodeRef } from '@/components/chat/ppt/pptNodeBridge'

/** 选中节点（含 SVG 用户坐标 bbox，用于高亮框） */
export interface PptSelectedNode {
  id: string
  tag: string
  text: string
  box: { x: number; y: number; width: number; height: number }
}

/** 视为"点击"而非拖拽的最大位移（px） */
export const CLICK_DRAG_THRESHOLD = 5

export const usePptNodePick = (options: {
  /** 当前页 SVG 字符串（渲染缓存） */
  svg: Ref<string | undefined>
  /** 当前页 JSON 根节点数组（映射数据源） */
  slide: Ref<SlideNode[] | undefined>
  /** 当前 PPT 文件标识（回填引用用） */
  pptId: Ref<string | undefined>
  /** 当前页码（1 起始，回填引用用） */
  page: Ref<number>
  /** 内联 SVG 挂载点（模板 ref） */
  svgHostRef: Ref<HTMLElement | null>
}) => {
  const pickable = ref(false)
  const selected = ref<PptSelectedNode | null>(null)

  const pickNode = inject(PPT_NODE_PICK_KEY, null)

  let svgEl: SVGSVGElement | null = null
  let highlightRect: SVGRectElement | null = null

  const clearSelection = () => {
    selected.value = null
    highlightRect?.remove()
    highlightRect = null
  }

  /** 屏幕坐标 → SVG 用户坐标 */
  const toSvgPoint = (clientX: number, clientY: number): DOMPoint | null => {
    if (!svgEl) return null
    const ctm = svgEl.getScreenCTM()
    if (!ctm) return null
    const pt = svgEl.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    return pt.matrixTransform(ctm.inverse())
  }

  const selectGroup = (group: Element) => {
    const id = group.getAttribute('data-node-id')
    if (!id) return
    const rect = group.getBoundingClientRect()
    const tl = toSvgPoint(rect.left, rect.top)
    const br = toSvgPoint(rect.right, rect.bottom)
    if (!tl || !br) return
    clearSelection()
    selected.value = {
      id,
      tag: group.getAttribute('data-node-tag') ?? '',
      text: group.getAttribute('data-node-text') ?? '',
      box: { x: tl.x, y: tl.y, width: br.x - tl.x, height: br.y - tl.y }
    }
    if (svgEl) {
      const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      r.setAttribute('x', String(tl.x))
      r.setAttribute('y', String(tl.y))
      r.setAttribute('width', String(br.x - tl.x))
      r.setAttribute('height', String(br.y - tl.y))
      r.setAttribute('fill', 'none')
      r.setAttribute('stroke', 'var(--td-brand-color)')
      r.setAttribute('stroke-width', '2')
      r.setAttribute('pointer-events', 'none')
      svgEl.appendChild(r)
      highlightRect = r
    }
  }

  /** 视口 click：区分平移后处理点选 */
  const handleViewportClick = (e: MouseEvent) => {
    if (!svgEl || !pickable.value) return
    // 阻止 SVG 内超链接（<a href>）默认跳转
    e.preventDefault()
    const target = e.target as Element
    const group = target.closest('[data-node-id]')
    if (group) selectGroup(group)
    else clearSelection()
  }

  /** 「引用此节点」确认：经桥注入聊天输入框（无桥降级复制 nodeId） */
  const confirmPick = () => {
    const node = selected.value
    if (!node) return
    const ref: PptNodeRef = {
      pptId: options.pptId.value ?? '',
      slide: options.page.value,
      nodeId: node.id,
      label: node.text || node.id
    }
    if (pickNode) {
      pickNode(ref)
      MessagePlugin.success('已将 PPT 节点引用添加到输入框')
    } else {
      void navigator.clipboard?.writeText(node.id)
      MessagePlugin.info('已复制节点 id：' + node.id)
    }
  }

  // 当前页 SVG / JSON / 挂载点变化 → 重新挂载内联 SVG 并映射
  // （svgHostRef 从 null → 元素时也会触发，覆盖首次挂载宿主未渲染的时序）
  watch(
    [options.svg, options.slide, options.svgHostRef],
    () => {
      const host = options.svgHostRef.value
      const svgString = options.svg.value
      const slide = options.slide.value
      clearSelection()
      svgEl = null
      if (!host) return
      host.replaceChildren()
      if (!svgString || !slide) {
        pickable.value = false
        return
      }
      const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml')
      // parseFromString 的 documentElement 类型为 HTMLElement，解析 image/svg+xml 时实为 <svg>
      const root = doc.documentElement as unknown as SVGSVGElement
      if (root.tagName.toLowerCase() === 'parsererror' || root.tagName !== 'svg') {
        pickable.value = false
        return
      }
      const { pickable: ok, nodeInfos } = mapSlideGroups(root, slide)
      pickable.value = ok
      svgEl = root
      // 分组上补充 tag / text 供选中回填（避免再查 JSON）
      if (ok) {
        root.querySelectorAll('[data-node-id]').forEach((el) => {
          const id = el.getAttribute('data-node-id')
          const info = id ? nodeInfos.get(id) : undefined
          if (info) {
            el.setAttribute('data-node-tag', info.tag)
            el.setAttribute('data-node-text', info.text)
          }
        })
      }
      host.appendChild(root)
    },
    { immediate: true }
  )

  return { pickable, selected, handleViewportClick, confirmPick, clearSelection }
}
