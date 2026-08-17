<template>
  <div class="ppt-slide-viewer">
    <div class="ppt-slide-viewer__toolbar">
      <span class="ppt-slide-viewer__page">{{ page }} / {{ total }}</span>
      <t-slider
        v-model="page"
        :min="1"
        :max="sliderMax"
        :step="1"
        class="ppt-slide-viewer__slider"
        :disabled="total < 1"
      />
      <span class="ppt-slide-viewer__scale">{{ scalePercent }}</span>
      <t-button
        variant="text"
        size="small"
        :disabled="!isScaled"
        title="重置缩放与位置"
        @click="reset"
      >
        重置
      </t-button>
      <template v-if="selectedNode">
        <t-button theme="primary" size="small" @click="confirmPick">引用此节点</t-button>
        <t-button variant="text" size="small" title="取消选中" @click="clearSelection"
          >取消</t-button
        >
      </template>
    </div>
    <div
      ref="_viewportRef"
      class="ppt-slide-viewer__viewport"
      :class="{ 'ppt-slide-viewer__viewport--dragging': isDragging }"
      tabindex="0"
      @wheel="handleWheel"
      @pointerdown="handleViewportPointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerUp"
      @click="handleClick"
      @dblclick="handleViewportDblclick"
      @keydown="handleKeydown"
    >
      <div v-if="total < 1" class="ppt-slide-viewer__empty">本页暂无内容</div>
      <div v-else class="ppt-slide-viewer__wrap" :style="{ transform: transformStyle }">
        <div class="ppt-slide-viewer__fit" :style="{ transform: `scale(${fitScale})` }">
          <div ref="hostRef" class="ppt-slide-viewer__host">
            <ppt-slide-surface :slide="nodes ?? []" :theme="theme" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
/**
 * PPT 主视图（vueRender 渲染层）：PptSlideSurface 固定 1280×720，外层两级变换——
 * fit 层按视口自适应等比缩放（初始即完整可见），pan/zoom 层提供滚轮缩放 + 拖拽平移
 * （usePptPanZoom 的锚点数学对内层常数缩放不变）。单击选中节点、双击直接注入引用。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { PptTheme, SlideNode } from '@/modules/ppt/pptTypes'
import { PPT_SLIDE_SIZE } from '@/modules/ppt/pptTypes'
import PptSlideSurface from '@/modules/ppt/vueRender/PptSlideSurface.vue'
import { usePptPanZoom } from './usePptPanZoom'
import { usePptNodePick, CLICK_DRAG_THRESHOLD } from './usePptNodePick'

const props = defineProps<{
  /** 当前页 JSON 根节点数组（渲染与点选摘要来源） */
  nodes?: SlideNode[]
  /** 文档主题令牌表（$token 解析） */
  theme: PptTheme
  /** 当前 PPT 文件标识（回填引用用） */
  pptId?: string
  page: number
  total: number
  sliderMax: number
}>()

const emit = defineEmits<{
  (e: 'update:page', value: number): void
}>()

const {
  viewportRef: _viewportRef,
  isDragging,
  dragDistance,
  isScaled,
  scalePercent,
  transformStyle,
  reset,
  handleWheel,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp
} = usePptPanZoom()

const hostRef = ref<HTMLElement | null>(null)

const slide = computed(() => props.nodes)
const pptId = computed(() => props.pptId)
const page = computed({
  get: () => props.page,
  set: (value) => emit('update:page', value)
})

const {
  selected: selectedNode,
  handleViewportClick,
  handleViewportDblclick,
  confirmPick,
  clearSelection
} = usePptNodePick({ slide, pptId, page, hostRef })

/** fit 层：视口自适应缩放（内容重渲染时选中态由 usePptNodePick 的 outline 承载） */
const fitScale = ref(1)
let fitObserver: ResizeObserver | null = null

const refit = (): void => {
  const viewport = _viewportRef.value
  if (!viewport) return
  const scale = Math.min(
    viewport.clientWidth / PPT_SLIDE_SIZE.w,
    viewport.clientHeight / PPT_SLIDE_SIZE.h
  )
  fitScale.value = Math.max(0.05, scale)
  clearSelection()
}

onMounted(() => {
  refit()
  fitObserver = new ResizeObserver(refit)
  if (_viewportRef.value) fitObserver.observe(_viewportRef.value)
})
onBeforeUnmount(() => {
  fitObserver?.disconnect()
  fitObserver = null
})

/** 视口按下时先平移拖拽，再显式聚焦（点击任意位置后即可用方向键翻页） */
const handleViewportPointerDown = (e: PointerEvent) => {
  handlePointerDown(e)
  _viewportRef.value?.focus({ preventScroll: true })
}

/**
 * 视口聚焦时的键盘翻页：↑ 上一页 / ↓ 下一页（边界内 clamp，无页时无操作）。
 * 仅绑定在视口自身，slider / 按钮聚焦时不受影响。
 */
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (props.page > 1) page.value = props.page - 1
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (props.page < props.total) page.value = props.page + 1
  }
}

/** 区分平移拖拽：位移超过阈值视为拖拽，不触发点选 */
const handleClick = (e: MouseEvent) => {
  const isDrag = dragDistance.value >= CLICK_DRAG_THRESHOLD
  dragDistance.value = 0
  if (isDrag) return
  handleViewportClick(e)
}
</script>
<style scoped lang="less">
.ppt-slide-viewer {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-right: 8px;

  &__toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  &__page {
    min-width: 52px;
    text-align: center;
    color: var(--td-text-color-secondary);
    font-size: var(--td-font-size-body-small);
    white-space: nowrap;
  }

  &__scale {
    min-width: 44px;
    text-align: right;
    color: var(--td-text-color-secondary);
    font-size: var(--td-font-size-body-small);
    white-space: nowrap;
  }

  &__slider {
    flex: 1;
    min-width: 0;
  }

  &__viewport {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--td-bg-color-component);
    border-radius: var(--td-radius-medium);
    position: relative;
    cursor: grab;
    user-select: none;
    touch-action: none;

    &--dragging {
      cursor: grabbing;
    }

    &:focus-visible {
      outline: none;
      box-shadow: 0 0 0 2px var(--td-brand-color);
    }
  }

  &__empty {
    color: var(--td-text-color-placeholder);
    font-size: var(--td-font-size-body-small);
  }

  &__wrap {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    transform-origin: center;
  }

  &__fit {
    flex-shrink: 0;
    transform-origin: center;
  }

  &__host {
    box-shadow: var(--td-shadow-2);
    border-radius: var(--td-radius-small);
    overflow: hidden;

    :deep([data-node-id]) {
      cursor: pointer;
    }
  }
}
</style>
