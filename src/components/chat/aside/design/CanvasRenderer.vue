<template>
  <div ref="containerRef" class="canvas-renderer">
    <div class="canvas-renderer__viewport" :style="{ padding: '8px' }">
      <div class="canvas-renderer__stage">
        <div ref="canvasHost" class="canvas-renderer__host" />
      </div>
    </div>
    <div v-if="!store.current.value" class="canvas-renderer__empty">暂无画布</div>
  </div>
</template>
<script lang="ts" setup>
import { App, EditorEvent } from 'leafer-editor'
import { MessageUtil } from '@/utils/modal'
import { ensureFontsForDoc, getCanvasStore, buildDocElements } from '@/modules/canvas'
import type { CanvasDoc, CanvasNode } from '@/modules/canvas'
import { CANVAS_NODE_PICK_KEY } from '@/components/chat/design/canvasNodeBridge'

/** 双击命中的元素最小结构（leafer 2.2.9 的 d.ts 被混淆，用本地接口收窄，避免 any） */
interface CanvasTapTarget {
  id?: string
  parent?: CanvasTapTarget | null
}

/** 编辑器选中事件的最小结构（value 单选中为元素，多选中为数组） */
interface CanvasSelectTarget {
  id?: string
}
interface CanvasSelectEvent {
  value?: CanvasSelectTarget | CanvasSelectTarget[] | null
}

const props = withDefaults(
  defineProps<{
    sandbox?: string
    /** 外部指定选中的节点 id（元素树联动）：变化时在画布上同步选中 */
    selectedId?: string
  }>(),
  {
    sandbox: '',
    selectedId: undefined
  }
)

const emit = defineEmits<{
  (e: 'select', id: string | undefined): void
}>()

const store = computed(() => getCanvasStore(props.sandbox ?? ''))

/** 画布侧边栏 → 聊天输入框的注入回调（LChatEngine provide），为空时降级为复制节点 id */
const pickCanvasNode = inject(CANVAS_NODE_PICK_KEY, null)

const containerRef = ref<HTMLElement>()
const canvasHost = ref<HTMLElement>()
const { width: containerWidth, height: containerHeight } = useElementSize(containerRef)

let app: App | null = null

/** 在节点树中按 id 查找节点（含子树） */
const findNode = (nodes: CanvasNode[], id: string): CanvasNode | null => {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children?.length) {
      const found = findNode(node.children, id)
      if (found) return found
    }
  }
  return null
}

/** 双击画布元素：把「画布版本 + 节点 id」注入到聊天输入框，让 AI 能 canvas_open(version) 定位并修改 */
const handleDoubleTap = (event: { target?: CanvasTapTarget | null }) => {
  let el = event.target
  while (el && !el.id) el = el.parent ?? null
  if (!el?.id) return
  const doc = store.value.current.value
  if (!doc) return
  const node = findNode(doc.nodes, el.id)
  const ref = { version: doc.version, nodeId: el.id, label: node?.name || el.id }
  if (pickCanvasNode) {
    pickCanvasNode(ref)
    MessageUtil.success('已将画布节点添加到输入框')
    return
  }
  // 无输入框桥接时降级为复制节点 id（保留原能力）
  if (window.preload.inject.clipboard.copyText(el.id)) {
    MessageUtil.success(`已复制元素 id：${el.id}`)
  } else {
    MessageUtil.error('复制失败')
  }
}

onMounted(() => {
  if (!canvasHost.value) return
  // tree: 'design' 注册 viewport（滚轮缩放 + 空格拖拽平移）；editor 配置自动创建 app.editor（sky 层选中交互）
  // sky 不启用 viewport：编辑器通过监听 tree 渲染变化自行对齐选中框，避免二次变换
  app = new App({
    view: canvasHost.value,
    tree: { type: 'design' },
    editor: {
      // 仅支持选中，暂不支持移动/缩放/旋转等编辑操作
      moveable: false,
      resizeable: false,
      rotateable: false,
      skewable: false,
      flipable: false,
      preventEditInner: true,
      hover: false
    },
    move: { holdSpaceKey: true },
    zoom: { min: 0.1, max: 8 },
    // 普通滚轮即缩放（不含修饰键）
    wheel: { zoomMode: 'mouse' }
  })
  // 双击元素 → 把画布版本 + 节点 id 注入聊天输入框（供 AI 定位修改；沿 parent 链向上取最近带 id 元素：
  // 命中叶子复制自身 id，命中 group 背景 rect 回退到 group id，空白画布无 id 则忽略）
  app.tree.on('double_tap', handleDoubleTap)
  // 画布选中变化（点击元素 / 程序化 select / render 重建时 cancel）→ 上抛给元素树联动
  app.editor.on(EditorEvent.SELECT, handleEditorSelect)
  render()
})

onBeforeUnmount(() => {
  app?.destroy?.()
  app = null
})

/** 编辑器选中事件 → 提取单个节点 id 上抛（多选只取首个，空白画布选中为空） */
const handleEditorSelect = (event: CanvasSelectEvent) => {
  const value = event.value
  const id = Array.isArray(value) ? value[0]?.id : value?.id
  emit('select', id)
}

// 元素树选中 → 画布同步：按 id 找到渲染元素并选中；id 失效时取消选中
watch(
  () => props.selectedId,
  (id) => {
    if (!app) return
    if (id == null) {
      app.editor.cancel()
      return
    }
    const target = app.tree.findId(id)
    if (target) app.editor.select(target)
    else app.editor.cancel()
  }
)

/** 等比缩放到容器内，返回缩放比例（画布过大时缩小，过小时保持原大） */
const fitScale = (doc: CanvasDoc): number => {
  const availW = Math.max(containerWidth.value - 48, 40)
  const availH = Math.max(containerHeight.value - 48, 40)
  return Math.min(1, availW / doc.width, availH / doc.height)
}

/** 重置视图变换（缩放/平移），回到 fit 初始态 */
const resetView = () => {
  const tree = app?.tree
  if (tree) {
    tree.scaleX = 1
    tree.scaleY = 1
    tree.x = 0
    tree.y = 0
  }
}

// 当前渲染对应的视图标识（画布版本 + 容器尺寸），用于判断是否重置缩放/平移
let viewKey = ''

const render = async () => {
  if (!app) return
  const doc = store.value.current.value
  app.tree.clear()
  app.editor?.cancel()
  if (!doc) return
  // 确保画布用到的字体已加载（资源库 / 在线字体走 FontFace），保证预览与 measureText 用同一字体源
  await ensureFontsForDoc(doc)
  const width = Math.max(40, Math.round(containerWidth.value - 16))
  const height = Math.max(40, Math.round(containerHeight.value - 16))
  const key = `${doc.version}@${width}x${height}`
  const needReset = viewKey !== key
  viewKey = key
  app.resize({ width, height })
  const scale = fitScale(doc)
  const offsetX = (width - doc.width * scale) / 2
  const offsetY = (height - doc.height * scale) / 2
  // 背景 + 全部根图层统一包在可缩放根 Group 中（buildDocElements 返回 [rootGroup]）
  const [root] = buildDocElements(doc, scale, offsetX, offsetY)
  if (root) app.tree.add(root)
  if (needReset) resetView()
}

// 画布内容变化（AI 操作）或容器尺寸变化 → 重建渲染
watch(() => store.value.current.value, render, { deep: true })
watch([containerWidth, containerHeight], () => {
  if (store.value.current.value) render()
})

defineExpose({ render })
</script>
<style scoped lang="less">
.canvas-renderer {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;

  &__viewport {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
  }

  &__stage {
    margin: auto;
    max-width: 100%;
    max-height: 100%;
    overflow: auto;
    border-radius: var(--td-radius-medium);
    box-shadow: var(--td-shadow-2);
  }

  &__empty {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--td-text-color-placeholder);
    font-size: var(--td-font-size-body-small);
  }
}
</style>
