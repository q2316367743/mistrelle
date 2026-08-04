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
import { App, Rect } from 'leafer-editor'
import { getCanvasStore } from '@/modules/tool/components/canvas/CanvasStore'
import { scaleShape } from '@/modules/tool/components/canvas/canvasRender'
import type { CanvasDoc } from '@/modules/tool/components/canvas/canvasTypes'

const props = defineProps<{
  sandbox?: string
}>()

const store = computed(() => getCanvasStore(props.sandbox ?? ''))

const containerRef = ref<HTMLElement>()
const canvasHost = ref<HTMLElement>()
const { width: containerWidth, height: containerHeight } = useElementSize(containerRef)

let app: App | null = null

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
  render()
})

onBeforeUnmount(() => {
  app?.destroy?.()
  app = null
})

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

const render = () => {
  if (!app) return
  const doc = store.value.current.value
  app.tree.clear()
  app.editor?.cancel()
  if (!doc) return
  const width = Math.max(40, Math.round(containerWidth.value - 16))
  const height = Math.max(40, Math.round(containerHeight.value - 16))
  const key = `${doc.version}@${width}x${height}`
  const needReset = viewKey !== key
  viewKey = key
  app.resize({ width, height })
  const scale = fitScale(doc)
  const offsetX = (width - doc.width * scale) / 2
  const offsetY = (height - doc.height * scale) / 2
  // 背景层：铺满画布的矩形，保证浅色画布与预览底色一致
  app.tree.add(
    new Rect({
      x: offsetX,
      y: offsetY,
      width: doc.width * scale,
      height: doc.height * scale,
      fill: doc.background || '#ffffff'
    })
  )
  for (const shape of doc.shapes) {
    app.tree.add(scaleShape(shape, scale, offsetX, offsetY))
  }
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
