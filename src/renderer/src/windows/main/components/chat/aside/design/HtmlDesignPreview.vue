<template>
  <div ref="bodyRef" class="html-design-preview">
    <div v-if="!doc" class="html-design-preview__empty">{{ emptyText }}</div>
    <div
      v-else
      class="html-design-preview__stage"
      :style="{ width: `${doc.width * scale}px`, height: `${doc.height * scale}px` }"
    >
      <iframe
        ref="frameRef"
        class="html-design-preview__frame"
        sandbox="allow-same-origin"
        title="HTML 设计稿预览"
        :style="{
          width: `${doc.width}px`,
          height: `${doc.height}px`,
          transform: `scale(${scale})`
        }"
      />
    </div>
  </div>
</template>
<script lang="ts" setup>
import { prepareDesignHtmlDocument, type HtmlDesignDoc } from '@/windows/main/modules/designHtml'
import type { HtmlTreeNode } from '@/windows/main/components/chat/design/htmlElementBridge'
import {
  applySelection,
  buildTree,
  describeChain,
  ensureSelectionStyle,
  pathOfElement,
  resolvePath
} from './htmlPreviewDom'

const props = withDefaults(
  defineProps<{
    /** 当前设计稿（null 显示占位）；doc 变更即重建预览文档与元素树 */
    doc?: HtmlDesignDoc | null
    /** 选中的元素路径（'0;1;2'，body 相对索引链）：外部（元素树）与内部（单击/滚轮）共同驱动 */
    selectedPath?: string
  }>(),
  {
    doc: null,
    selectedPath: undefined
  }
)

const emit = defineEmits<{
  /** 选中状态变化（单击 / 滚轮 / 渲染后失效回退），undefined = 取消选中 */
  (e: 'select', path: string | undefined): void
  /** 双击元素（注入聊天）：携带路径与完整描述链 */
  (e: 'pick', payload: { path: string; chain: string }): void
  /** 渲染后的元素树（body 相对索引路径），供全屏元素树消费 */
  (e: 'treeChange', nodes: HtmlTreeNode[]): void
}>()

const emptyText = '请先让 AI 创建 HTML 设计稿'
const bodyRef = ref<HTMLElement>()
const frameRef = ref<HTMLIFrameElement>()
/** 预览缩放：contain 适配容器，上限 1x 防止放大模糊 */
const scale = ref(1)

/** 滚轮缩小的候选栈：扩大（滚轮上）时压入当前路径，缩小（滚轮下）时优先弹回 */
const shrinkStack = ref<string[]>([])
/** 最近一次滚轮发出的路径：区分「滚轮产生」与「树/双击产生」的选中变化，后者清空候选栈 */
let lastWheelPath: string | undefined

// ─── iframe 事件（挂 contentWindow，跨 doc.write 存活；iframe 内零脚本） ──

let attachedWin: Window | null = null

const iframeTarget = (e: Event): { doc: Document; el: Element } | null => {
  const frameDoc = frameRef.value?.contentDocument
  if (!frameDoc) return null
  const target = e.target
  if (!target || (target as Node).nodeType !== 1) return null
  const el = target as Element
  if (!frameDoc.contains(el)) return null
  return { doc: frameDoc, el }
}

const handleDblClick = (e: MouseEvent) => {
  const hit = iframeTarget(e)
  if (!hit) return
  const path = pathOfElement(hit.doc, hit.el)
  if (path === null) {
    emit('select', undefined)
    return
  }
  // 单击已完成选中，双击仅补发「注入聊天」
  emit('pick', { path, chain: describeChain(hit.doc, hit.el) })
}

/** 单击元素 = 选中（蓝框 + 元素树联动）；body 空白 = 取消选中。返回是否选中了元素 */
const selectFromClick = (hit: { doc: Document; el: Element }): boolean => {
  const path = pathOfElement(hit.doc, hit.el)
  if (path === null) {
    emit('select', undefined)
    return false
  }
  shrinkStack.value = []
  lastWheelPath = undefined
  emit('select', path)
  return true
}

const handleClick = (e: MouseEvent) => {
  const hit = iframeTarget(e)
  if (!hit) return
  selectFromClick(hit)
}

const handleWheel = (e: WheelEvent) => {
  const hit = iframeTarget(e)
  if (!hit) return
  e.preventDefault()
  const curPath = props.selectedPath
  if (!curPath) return
  if (e.deltaY < 0) {
    // 滚轮上：扩大到父元素（顶层元素之上是 body，不再扩大）
    const el = resolvePath(hit.doc, curPath)
    const parent = el?.parentElement
    if (!el || !parent || parent === hit.doc.body) return
    const parentPath = pathOfElement(hit.doc, parent)
    if (parentPath === null) return
    shrinkStack.value = [...shrinkStack.value, curPath]
    lastWheelPath = parentPath
    emit('select', parentPath)
  } else {
    // 滚轮下：优先弹回之前缩小的候选，栈空则进入第一个元素子
    const next = shrinkStack.value.pop()
    if (next) {
      lastWheelPath = next
      emit('select', next)
      return
    }
    const el = resolvePath(hit.doc, curPath)
    if (!el) return
    const first = el.children[0]
    const view = el.ownerDocument.defaultView
    if (!first || !view || !(first instanceof view.Element)) return
    const firstPath = pathOfElement(hit.doc, first)
    if (firstPath === null) return
    lastWheelPath = firstPath
    emit('select', firstPath)
  }
}

const attachEvents = () => {
  const win = frameRef.value?.contentWindow
  if (!win || attachedWin === win) return
  attachedWin = win
  win.addEventListener('dblclick', handleDblClick)
  win.addEventListener('click', handleClick)
  win.addEventListener('wheel', handleWheel, { passive: false })
}

// ─── 渲染 / 缩放 ─────────────────────────────────────────────

const updateScale = () => {
  const doc = props.doc
  const body = bodyRef.value
  if (!doc || !body) return
  const s = Math.min((body.clientWidth - 12) / doc.width, (body.clientHeight - 12) / doc.height)
  scale.value = Math.max(0.05, Math.min(1, s))
}

const renderDoc = async (doc: HtmlDesignDoc) => {
  const frame = frameRef.value
  if (!frame) return
  const html = await prepareDesignHtmlDocument(doc)
  const docEl = frame.contentDocument
  if (!docEl) return
  docEl.open()
  docEl.write(html)
  docEl.close()
  attachEvents()
  ensureSelectionStyle(docEl)
  emit('treeChange', buildTree(docEl))
  // 重渲染后回放选中：路径失效（结构变更）则取消选中
  if (props.selectedPath && !applySelection(docEl, props.selectedPath)) {
    emit('select', undefined)
  }
}

// doc 变更 → 重建预览；flush: post 保证 v-else 分支的 iframe 已挂载后再写入文档
watch(
  () => props.doc,
  async (doc) => {
    updateScale()
    if (doc) await renderDoc(doc)
  },
  { flush: 'post' }
)

// 选中变化（树点击 / 滚轮 / 双击回环）→ 应用蓝框；非滚轮来源清空缩小候选栈
watch(
  () => props.selectedPath,
  (path) => {
    if (path !== lastWheelPath) shrinkStack.value = []
    lastWheelPath = undefined
    const docEl = frameRef.value?.contentDocument
    if (docEl) applySelection(docEl, path)
  }
)

// 容器尺寸变化时重算 contain 缩放（侧边栏拖宽 / 全屏切换）
const { width: bodyWidth, height: bodyHeight } = useElementSize(bodyRef)
watch([bodyWidth, bodyHeight], () => updateScale())
</script>
<style scoped lang="less">
.html-design-preview {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  &__empty {
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-placeholder);
  }

  &__stage {
    position: relative;
    overflow: hidden;
    border-radius: var(--td-radius-medium);
    box-shadow: var(--td-shadow-1);
  }

  &__frame {
    display: block;
    border: 0;
    background: var(--td-bg-color-page);
    transform-origin: top left;
  }
}
</style>
