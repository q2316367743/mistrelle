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
      @keydown="handleKeydown"
    >
      <div v-if="renderState === 'rendering'" class="ppt-slide-viewer__loading">渲染中…</div>
      <div
        v-else-if="svg"
        class="ppt-slide-viewer__svg-wrap"
        :style="{ transform: transformStyle }"
      >
        <div ref="svgHostRef" class="ppt-slide-viewer__svg-host"></div>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { computed, ref } from 'vue'
import type { PptRenderState, SlideNode } from '@/modules/ppt/pptTypes'
import { usePptPanZoom } from './usePptPanZoom'
import { usePptNodePick, CLICK_DRAG_THRESHOLD } from './usePptNodePick'

const props = defineProps<{
  /** 当前页 SVG 字符串（主进程 textOutput:'text' 渲染，含 <text> 可做节点映射） */
  svg?: string
  /** 当前页 JSON 根节点数组（映射与回填引用用） */
  nodes?: SlideNode[]
  /** 当前 PPT 文件标识（回填引用用） */
  pptId?: string
  renderState: PptRenderState
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

const svgHostRef = ref<HTMLElement | null>(null)

const svg = computed(() => props.svg)
const slide = computed(() => props.nodes)
const pptId = computed(() => props.pptId)
const page = computed({
  get: () => props.page,
  set: (value) => emit('update:page', value)
})

const {
  selected: selectedNode,
  handleViewportClick,
  confirmPick,
  clearSelection
} = usePptNodePick({
  svg,
  slide,
  pptId,
  page,
  svgHostRef
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

  &__loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--td-text-color-placeholder);
    font-size: var(--td-font-size-body-small);
  }

  &__svg-wrap {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    transform-origin: center;
  }

  &__svg-host {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;

    svg {
      display: block;
      width: auto;
      height: auto;
      max-width: 100%;
      max-height: 100%;
      box-shadow: var(--td-shadow-2);
      border-radius: var(--td-radius-small);
      background: #fff;

      [data-node-id] {
        cursor: pointer;
      }
    }
  }
}
</style>
