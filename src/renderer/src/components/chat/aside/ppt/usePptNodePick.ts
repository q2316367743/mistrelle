/**
 * PPT 主视图节点点选组合式函数（vueRender 渲染层）：
 * - 组件根元素自带 data-node-id（含复合节点子项），closest 命中即精确到 JSON 节点——
 *   含 zIndex / Arrow 的页与 TimelineItem / FlowNode / Td 等子项均可选中
 * - 单击选中（outline 高亮，随内容重渲染自动清除）、点击空白取消
 * - 双击 = 选中 + 立即注入节点引用到聊天输入框（省去确认按钮步骤）
 * - 「引用此节点」按钮保留（单击选中后的确认路径）
 */
import { inject, ref, watch, type Ref } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import type { SlideNode } from '@/modules/ppt/pptTypes'
import { PPT_NODE_PICK_KEY } from '@/components/chat/ppt/pptNodeBridge'
import type { PptNodeRef } from '@/components/chat/ppt/pptNodeBridge'

/** 选中节点摘要 */
export interface PptSelectedNode {
  id: string
  tag: string
  text: string
}

/** 视为"点击"而非拖拽的最大位移（px） */
export const CLICK_DRAG_THRESHOLD = 5

/** 页内按 id 深搜节点 */
const findNode = (nodes: SlideNode[], id: string): SlideNode | null => {
  for (const node of nodes) {
    if (node.id === id) return node
    if (Array.isArray(node.child)) {
      const found = findNode(node.child, id)
      if (found) return found
    }
  }
  return null
}

export const usePptNodePick = (options: {
  /** 当前页 JSON 根节点数组（节点摘要来源） */
  slide: Ref<SlideNode[] | undefined>
  /** 当前 PPT 文件标识（回填引用用） */
  pptId: Ref<string | undefined>
  /** 当前页码（1 起始，回填引用用） */
  page: Ref<number>
  /** 画布挂载点（模板 ref，点选事件在其上冒泡捕获） */
  hostRef: Ref<HTMLElement | null>
}) => {
  const selected = ref<PptSelectedNode | null>(null)
  const pickNode = inject(PPT_NODE_PICK_KEY, null)

  let outlined: HTMLElement | null = null

  const clearSelection = () => {
    selected.value = null
    if (outlined) {
      outlined.style.outline = ''
      outlined = null
    }
  }

  /** 选中元素：outline 高亮 + 从 JSON 回填摘要 */
  const selectEl = (el: Element): PptSelectedNode | null => {
    const id = el.getAttribute('data-node-id')
    if (!id) return null
    if (outlined) outlined.style.outline = ''
    outlined = el instanceof HTMLElement ? el : (el.parentElement ?? null)
    if (outlined) outlined.style.outline = '2px solid var(--td-brand-color)'
    const node = options.slide.value ? findNode(options.slide.value, id) : null
    const info: PptSelectedNode = {
      id,
      tag: node?.tag ?? '',
      text: typeof node?.child === 'string' ? node.child : node?.attr.label ?? node?.attr.title ?? node?.attr.text ?? ''
    }
    selected.value = info
    return info
  }

  /** 视口 click：区分平移后处理点选 */
  const handleViewportClick = (e: MouseEvent) => {
    const target = e.target as Element
    const el = target.closest('[data-node-id]')
    if (el) {
      e.preventDefault()
      selectEl(el)
    } else {
      clearSelection()
    }
  }

  /** 注入节点引用到聊天输入框（无桥降级复制 nodeId） */
  const injectRef = (node: PptSelectedNode): void => {
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

  /** 双击：选中并立即注入引用 */
  const handleViewportDblclick = (e: MouseEvent) => {
    const target = e.target as Element
    const el = target.closest('[data-node-id]')
    if (!el) return
    e.preventDefault()
    const info = selectEl(el)
    if (info) injectRef(info)
  }

  /** 「引用此节点」确认（单击选中后的按钮路径） */
  const confirmPick = () => {
    const node = selected.value
    if (!node) return
    injectRef(node)
  }

  // 页切换或节点树替换时清除高亮与选中态
  watch([options.slide, options.page], () => {
    clearSelection()
  })

  return { selected, handleViewportClick, handleViewportDblclick, confirmPick, clearSelection }
}
