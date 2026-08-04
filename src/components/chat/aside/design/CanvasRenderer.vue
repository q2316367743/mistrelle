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
import { App, Rect, Ellipse, Text, Line, Image as LeaferImage } from 'leafer-ui'
import { getCanvasStore } from '@/modules/tool/components/canvas/CanvasStore'
import type { CanvasDoc, CanvasShape } from '@/modules/tool/components/canvas/canvasTypes'

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
  // App 仅在显式配置 tree 时才创建 app.tree 层（设计内容层），否则 tree 为 undefined
  app = new App({ view: canvasHost.value, tree: {} })
  render()
})

onBeforeUnmount(() => {
  app?.destroy?.()
  app = null
})

/** 等比缩放到容器内，返回缩放比例（画布过大时缩小，过小时保持原大） */
const fitScale = (doc: CanvasDoc): number => {
  const pad = 16
  const availW = Math.max(containerWidth.value - pad, 40)
  const availH = Math.max(containerHeight.value - pad, 40)
  return Math.min(1, availW / doc.width, availH / doc.height)
}

/** 手动等比缩放每个图形坐标，将 doc 空间映射到容器内 */
const scaleShape = (shape: CanvasShape, scale: number): Rect | Ellipse | Text | Line | LeaferImage => {
  const base = {
    x: shape.x * scale,
    y: shape.y * scale,
    rotation: shape.rotation,
    opacity: shape.opacity
  }
  const strokeStyle = {
    stroke: shape.stroke,
    strokeWidth: shape.strokeWidth != null ? shape.strokeWidth * scale : undefined
  }
  switch (shape.type) {
    case 'rect':
      return new Rect({
        ...base,
        width: (shape.width ?? 0) * scale,
        height: (shape.height ?? 0) * scale,
        fill: shape.fill ?? '#e6e6e6',
        ...strokeStyle
      })
    case 'ellipse':
      return new Ellipse({
        ...base,
        width: (shape.width ?? 0) * scale,
        height: (shape.height ?? 0) * scale,
        fill: shape.fill ?? '#e6e6e6',
        ...strokeStyle
      })
    case 'text':
      return new Text({
        ...base,
        text: shape.text ?? '',
        fontSize: (shape.fontSize ?? 16) * scale,
        fontFamily: shape.fontFamily,
        fontWeight: shape.fontWeight,
        fill: shape.textColor ?? '#000000'
      })
    case 'line':
      return new Line({
        x: 0,
        y: 0,
        points: (shape.points ?? []).map((n) => n * scale),
        stroke: shape.stroke ?? '#000000',
        strokeWidth: (shape.strokeWidth ?? 1) * scale,
        opacity: shape.opacity
      })
    case 'image':
      return new LeaferImage({
        ...base,
        width: (shape.width ?? 0) * scale,
        height: (shape.height ?? 0) * scale,
        src: shape.imageUrl
      })
  }
}

const render = () => {
  if (!app) return
  const doc = store.value.current.value
  app.tree.clear()
  if (!doc) return
  const scale = fitScale(doc)
  const width = Math.max(40, Math.round(doc.width * scale))
  const height = Math.max(40, Math.round(doc.height * scale))
  app.resize({ width, height })
  // 背景层：铺满画布的矩形，保证浅色画布与预览底色一致
  app.tree.add(
    new Rect({
      x: 0,
      y: 0,
      width,
      height,
      fill: doc.background || '#ffffff'
    })
  )
  for (const shape of doc.shapes) {
    app.tree.add(scaleShape(shape, scale))
  }
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
