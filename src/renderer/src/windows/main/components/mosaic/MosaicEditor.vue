<template>
  <div class="mosaic-editor">
    <div class="mosaic-editor__toolbar">
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
      <div v-if="mode === 'brush'" class="mosaic-editor__brush">
        <span class="mosaic-editor__label">粗细</span>
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
      <div class="mosaic-editor__cover">
        <t-radio-group v-model="style" variant="default-filled" size="small">
          <t-radio-button v-for="item in coverStyles" :key="item.value" :value="item.value">
            {{ item.label }}
          </t-radio-button>
        </t-radio-group>
        <t-slider
          v-model="strength"
          class="mosaic-editor__strength"
          :min="strengthRange.min"
          :max="strengthRange.max"
          :step="strengthRange.step"
        />
        <span class="mosaic-editor__label">{{ strengthLabel }}</span>
      </div>
      <span class="mosaic-editor__count">已标记 {{ markedCount }} 处</span>
      <div class="mosaic-editor__spacer" />
      <t-button size="small" variant="outline" :disabled="!canUndo" @click="undo">撤销</t-button>
      <t-button size="small" variant="outline" :disabled="isEmpty" @click="clearMarks">清空</t-button>
    </div>

    <div class="mosaic-editor__body">
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

      <div ref="stageRef" class="mosaic-editor__stage">
        <!-- 两层 canvas 同宽同位置：底层原图 + 像素化贴片，上层文字框 / 框选 / 笔刷光标 -->
        <div class="mosaic-editor__frame">
          <canvas ref="baseRef" class="mosaic-editor__canvas" />
          <canvas
            ref="overlayRef"
            class="mosaic-editor__canvas mosaic-editor__canvas--overlay"
            @pointerdown="handlePointerDown"
            @pointermove="handlePointerMove"
            @pointerup="handlePointerUp"
            @pointerleave="handlePointerLeave"
          />
        </div>
        <div v-if="ocrBusy" class="mosaic-editor__mask">正在识别文字…</div>
      </div>
    </div>

    <div class="mosaic-editor__footer">
      <span class="mosaic-editor__tip">{{ tipText }}</span>
      <t-button v-if="cancelLabel" variant="outline" @click="emit('close')">
        {{ cancelLabel }}
      </t-button>
      <t-button theme="primary" :loading="applying" :disabled="!canApply" @click="handleApply">
        {{ primaryLabel }}
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
import type { MosaicApplier } from './useMosaicEditor'

const props = defineProps<{
  /** 源图本地绝对路径 */
  source: string
  /** 已有的遮盖记录（打开即回填，支持局部增删 / 复原） */
  initial?: CanvasMosaic
  /** 应用出口：宿主决定落点（画布写记录 / 导出文件），并自负成功与失败提示 */
  apply: MosaicApplier
  /** 主按钮文案（默认「应用」） */
  applyLabel?: string
  /** 标记清空后主按钮文案（画布记录场景的「复原」；缺省与 applyLabel 相同） */
  restoreLabel?: string
  /** 取消按钮文案（不传则不渲染取消按钮） */
  cancelLabel?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  /** 应用成功（弹窗据此关闭） */
  (e: 'done'): void
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
  initial: props.initial,
  // 经 getter 转调，宿主换 applier 时无需重挂载编辑器
  apply: (payload) => props.apply(payload),
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

/** 空标记且有记录 = 复原（清除记录），否则用宿主给的主按钮文案 */
const primaryLabel = computed(() => {
  const label = props.applyLabel ?? '应用'
  if (isEmpty.value && canApply.value) return props.restoreLabel ?? label
  return label
})

const handleApply = async () => {
  if (await apply()) emit('done')
}

onMounted(() => {
  void start()
})
</script>
<style lang="less" src="./mosaicEditor.less"></style>
