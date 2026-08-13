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
    </div>
    <div
      ref="_viewportRef"
      class="ppt-slide-viewer__viewport"
      :class="{ 'ppt-slide-viewer__viewport--dragging': isDragging }"
      @wheel="handleWheel"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerUp"
    >
      <div v-if="renderState === 'rendering'" class="ppt-slide-viewer__loading">渲染中…</div>
      <img
        v-else-if="currentSvg"
        :src="currentSvg"
        :style="{ transform: transformStyle }"
        class="ppt-slide-viewer__img"
        draggable="false"
        alt="幻灯片"
      />
    </div>
  </div>
</template>
<script lang="ts" setup>
import type { PptRenderState } from '@/modules/ppt/pptTypes'
import { usePptPanZoom } from './usePptPanZoom'

const props = defineProps<{
  currentSvg?: string
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
  isScaled,
  scalePercent,
  transformStyle,
  reset,
  handleWheel,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp
} = usePptPanZoom()

/** 页码与父级（缩略图导航 / store.currentPage）双向联动 */
const page = computed({
  get: () => props.page,
  set: (value) => emit('update:page', value)
})
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

  &__img {
    display: block;
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    transform-origin: center;
    box-shadow: var(--td-shadow-2);
    border-radius: var(--td-radius-small);
    background: #fff;
  }
}
</style>
