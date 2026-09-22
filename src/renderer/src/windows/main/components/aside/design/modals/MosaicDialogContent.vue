<template>
  <div class="mosaic-dialog">
    <div class="mosaic-dialog__toolbar">
      <t-radio-group v-model="mode" variant="default-filled" size="small">
        <t-radio-button value="auto">
          <template #icon>
            <mosaic-icon />
          </template>
          文字识别
        </t-radio-button>
        <t-radio-button value="brush">
          <template #icon>
            <brush-icon />
          </template>
          手动涂抹
        </t-radio-button>
      </t-radio-group>
      <div v-if="mode === 'brush'" class="mosaic-dialog__brush">
        <span class="mosaic-dialog__label">粗细</span>
        <t-slider v-model="brushSize" :min="12" :max="64" :step="4" />
        <t-tooltip content="擦除已涂的遮盖区域">
          <t-button
            size="small"
            :theme="erasing ? 'primary' : 'default'"
            variant="outline"
            @click="erasing = !erasing"
          >
            {{ erasing ? '擦除中' : '擦除' }}
          </t-button>
        </t-tooltip>
      </div>
      <div class="mosaic-dialog__cover">
        <t-radio-group v-model="style" variant="default-filled" size="small">
          <t-radio-button v-for="item in coverStyles" :key="item.value" :value="item.value">
            {{ item.label }}
          </t-radio-button>
        </t-radio-group>
        <t-slider
          v-model="strength"
          class="mosaic-dialog__strength"
          :min="strengthRange.min"
          :max="strengthRange.max"
          :step="strengthRange.step"
        />
        <span class="mosaic-dialog__label">{{ strengthLabel }}</span>
      </div>
      <span class="mosaic-dialog__count">已标记 {{ markedCount }} 处</span>
      <div class="mosaic-dialog__spacer" />
      <t-button size="small" variant="outline" :disabled="!canUndo" @click="undo">撤销</t-button>
      <t-button size="small" variant="outline" :disabled="isEmpty" @click="clearMarks">清空</t-button>
    </div>

    <div class="mosaic-dialog__body">
      <mosaic-text-box-list
        v-if="mode === 'auto'"
        :texts="texts"
        :marked="markedBoxes"
        :hovered="hoveredBox"
        :busy="ocrBusy"
        :failed="ocrFailed"
        @toggle="toggleBox"
        @hover="setHovered"
        @recognize="recognize"
      />

      <div ref="stageRef" class="mosaic-dialog__stage">
        <!-- 两层 canvas 同宽同位置：底层原图 + 像素化贴片，上层文字框 / 框选 / 笔刷光标 -->
        <div class="mosaic-dialog__frame">
          <canvas ref="baseRef" class="mosaic-dialog__canvas" />
          <canvas
            ref="overlayRef"
            class="mosaic-dialog__canvas mosaic-dialog__canvas--overlay"
            @pointerdown="handlePointerDown"
            @pointermove="handlePointerMove"
            @pointerup="handlePointerUp"
            @pointerleave="handlePointerLeave"
          />
        </div>
        <div v-if="ocrBusy" class="mosaic-dialog__mask">正在识别文字…</div>
      </div>
    </div>

    <div class="mosaic-dialog__footer">
      <span class="mosaic-dialog__tip">{{ tipText }}</span>
      <t-button variant="outline" @click="emit('close')">取消</t-button>
      <t-button theme="primary" :loading="applying" :disabled="!canApply" @click="handleApply">
        {{ isEmpty && canApply ? '复原（清除记录）' : '应用' }}
      </t-button>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { computed } from 'vue'
import { BrushIcon, MosaicIcon } from 'tdesign-icons-vue-next'
import { ImageCoverStyleOptions } from '@common/types/mosaic'
import type { CanvasMosaic } from '@/windows/main/modules/canvas'
import MosaicTextBoxList from './MosaicTextBoxList.vue'
import { useMosaicEditor } from './useMosaicEditor'

const props = defineProps<{
  /** 源图本地绝对路径（画布 image 节点的 imageUrl） */
  source: string
  sandbox: string
  /** 遮盖记录写回的目标画布 image 节点 id */
  nodeId: string
  /** 节点已记录的遮盖（打开即回填，支持局部增删 / 复原） */
  initial?: CanvasMosaic
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success'): void
}>()

const stageRef = ref<HTMLElement>()
const baseRef = ref<HTMLCanvasElement>()
const overlayRef = ref<HTMLCanvasElement>()

const coverStyles = ImageCoverStyleOptions

const {
  mode,
  style,
  strength,
  strengthRange,
  brushSize,
  erasing,
  ocrBusy,
  ocrFailed,
  applying,
  texts,
  markedBoxes,
  hoveredBox,
  markedCount,
  isEmpty,
  canUndo,
  canApply,
  start,
  recognize,
  undo,
  clearMarks,
  toggleBox,
  setHovered,
  apply,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  handlePointerLeave
} = useMosaicEditor({
  source: props.source,
  sandbox: () => props.sandbox,
  nodeId: props.nodeId,
  initial: props.initial,
  stage: () => stageRef.value,
  base: () => baseRef.value,
  overlay: () => overlayRef.value
})

/** 强度文案随遮盖方式变化（马赛克=块边长越小越细腻 / 毛玻璃=模糊半径） */
const strengthLabel = computed(() =>
  style.value === 'blur'
    ? `模糊 ${strength.value}px`
    : `块边长 ${strength.value}px（越小越细腻）`
)

const tipText = computed(() => {
  if (mode.value === 'auto') return '点击文字框打码，拖动可批量框选；也可在左侧列表勾选'
  return erasing.value ? '涂抹已遮盖的区域将其擦除' : '在图上涂抹要遮盖的区域'
})

const handleApply = async () => {
  if (await apply()) emit('success')
}

onMounted(() => {
  void start()
})
</script>
<style scoped lang="less">
.mosaic-dialog {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__toolbar,
  &__footer {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  // 工具条控件较多（模式 / 笔刷 / 遮盖方式与强度 / 计数 / 操作），窄抽屉下允许换行
  &__toolbar {
    flex-wrap: wrap;
  }

  &__footer {
    justify-content: flex-end;
  }

  &__brush {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 230px;

    :deep(.t-slider) {
      flex: 1;
      min-width: 0;
    }
  }

  &__cover {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 380px;
  }

  &__strength {
    flex: 1;
    min-width: 80px;
  }

  &__label,
  &__tip,
  &__count {
    flex-shrink: 0;
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-secondary);
  }

  &__spacer {
    flex: 1;
  }

  &__body {
    flex: 1;
    min-height: 0;
    display: flex;
    gap: 8px;
  }

  &__stage {
    flex: 1;
    min-width: 0;
    min-height: 0;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border-radius: var(--td-radius-medium);
    background-color: var(--td-bg-color-secondarycontainer);
  }

  &__frame {
    position: relative;
    line-height: 0;
  }

  &__canvas {
    display: block;

    &--overlay {
      position: absolute;
      top: 0;
      left: 0;
      cursor: crosshair;
      touch-action: none;
    }
  }

  &__mask {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-secondary);
    pointer-events: none;
  }
}
</style>
