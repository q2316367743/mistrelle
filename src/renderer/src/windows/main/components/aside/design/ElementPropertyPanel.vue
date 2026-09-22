<template>
  <div class="element-property-panel">
    <div class="element-property-panel__header">
      <span>属性</span>
      <div v-if="node" class="element-property-panel__actions">
        <t-button
          size="small"
          theme="primary"
          :disabled="!dirty"
          :loading="saving"
          @click="handleSave"
        >
          保存
        </t-button>
        <t-button
          size="small"
          theme="danger"
          variant="text"
          shape="square"
          title="删除元素"
          :loading="deleting"
          @click="handleDelete"
        >
          <template #icon>
            <delete-icon />
          </template>
        </t-button>
      </div>
    </div>
    <div v-if="!node" class="element-property-panel__empty">在画布或元素树中选择元素</div>
    <div v-else class="element-property-panel__body">
      <div class="element-property-panel__meta">
        <span class="element-property-panel__type">{{ typeLabels[node.type] ?? node.type }}</span>
        <span class="element-property-panel__name ellipsis">{{ node.name || node.id }}</span>
      </div>
      <t-form label-align="top" class="element-property-panel__form">
        <div class="element-property-panel__group-title">尺寸</div>
        <t-form-item label="宽度 (px)">
          <t-input-number
            v-if="typeof draft.width === 'number'"
            v-model="widthNum"
            :min="1"
          />
          <t-input v-else :value="layoutSizeText(draft.width)" disabled placeholder="—" />
        </t-form-item>
        <t-form-item label="高度 (px)">
          <t-input-number
            v-if="typeof draft.height === 'number'"
            v-model="heightNum"
            :min="1"
          />
          <t-input v-else :value="layoutSizeText(draft.height)" disabled placeholder="—" />
        </t-form-item>
        <t-form-item label="不透明度">
          <t-input-number v-model="draft.opacity" :min="0" :max="1" :step="0.05" placeholder="1" />
        </t-form-item>

        <template v-if="showStroke">
          <div class="element-property-panel__group-title">外观</div>
          <t-form-item v-if="showFill" label="填充">
            <t-color-picker-panel
              v-if="!isGradientPaint(draft.fill)"
              v-model="fillColor"
              format="RGBA"
              enable-alpha
              clearable
              :default-recent-colors="false"
              :swatch-colors="null"
            />
            <t-input v-else value="渐变" disabled />
          </t-form-item>
          <t-form-item label="描边色">
            <t-color-picker-panel
              v-if="!isGradientPaint(draft.stroke)"
              v-model="strokeColor"
              format="RGBA"
              enable-alpha
              clearable
              :default-recent-colors="false"
              :swatch-colors="null"
            />
            <t-input v-else value="渐变" disabled />
          </t-form-item>
          <t-form-item label="描边宽度 (px)">
            <t-input-number v-model="draft.strokeWidth" :min="0" />
          </t-form-item>
          <t-form-item v-if="showCornerRadius" label="圆角 (px)">
            <t-input-number
              v-if="typeof draft.cornerRadius === 'number'"
              v-model="cornerRadiusNum"
              :min="0"
            />
            <t-input v-else value="多值圆角" disabled placeholder="—" />
          </t-form-item>
        </template>

        <template v-if="isPolygon || node.type === 'star'">
          <div class="element-property-panel__group-title">形状</div>
          <t-form-item v-if="isPolygon" label="边数">
            <t-input-number v-model="draft.sides" :min="3" />
          </t-form-item>
          <template v-if="node.type === 'star'">
            <t-form-item label="角数">
              <t-input-number v-model="draft.corners" :min="3" />
            </t-form-item>
            <t-form-item label="内半径">
              <t-input-number v-model="draft.innerRadius" :min="0" :max="1" :step="0.01" />
            </t-form-item>
          </template>
          <t-form-item label="起始角 (度)">
            <t-input-number v-model="draft.startAngle" :min="-180" :max="180" />
          </t-form-item>
        </template>
      </t-form>
      <text-property-fields v-if="node.type === 'text'" :draft="draft" />
      <image-mosaic-fields v-if="node.type === 'image'" :sandbox="sandbox" :node="node" />
    </div>
  </div>
</template>
<script lang="ts" setup>
import { computed, ref, toRef } from 'vue'
import { DeleteIcon } from 'tdesign-icons-vue-next'
import { MessageUtil } from '@/utils/modal'
import { firstBatchError, getCanvasStore } from '@/windows/main/modules/canvas'
import type { CanvasLayoutSize, CanvasNode } from '@/windows/main/modules/canvas'
import { isGradientPaint, usePropertyDraft } from './usePropertyDraft'
import TextPropertyFields from './TextPropertyFields.vue'
import ImageMosaicFields from './ImageMosaicFields.vue'

const props = defineProps<{
  sandbox: string
  /** 选中节点 id（空则显示占位空态，保持三栏宽度稳定） */
  nodeId?: string
}>()

const emit = defineEmits<{
  /** 删除成功（父组件清空选中态） */
  (e: 'deleted', id: string): void
}>()

const store = computed(() => getCanvasStore(props.sandbox))

const findNode = (nodes: CanvasNode[], id: string): CanvasNode | null => {
  for (const item of nodes) {
    if (item.id === id) return item
    if (item.children?.length) {
      const found = findNode(item.children, id)
      if (found) return found
    }
  }
  return null
}

const node = computed<CanvasNode | null>(() => {
  const id = props.nodeId
  const nodes = store.value.current.value?.nodes
  return id && nodes ? findNode(nodes, id) : null
})

/** 编辑只改本地草稿，点「保存」按钮才 diff 写回画布（batchEdit，与 AI 编辑同链路） */
const { draft, dirty, saving, handleSave, fillColor, strokeColor } = usePropertyDraft({
  node,
  nodeId: toRef(props, 'nodeId'),
  store
})

/** 删除元素：走 batchEdit delete（与 AI 同链路），成功后上抛让父组件清空选中 */
const deleting = ref(false)
const handleDelete = async () => {
  const id = props.nodeId
  if (!id || deleting.value) return
  deleting.value = true
  try {
    const { results } = await store.value.batchEdit([{ op: 'delete', id }])
    // batchEdit 单点容错不抛异常，须显式核对结果，否则失败也会提示「已删除」
    const failure = firstBatchError(results)
    if (failure) {
      MessageUtil.error('删除失败', failure)
      return
    }
    emit('deleted', id)
    MessageUtil.success('已删除元素')
  } catch (e) {
    MessageUtil.error('删除失败', e)
  } finally {
    deleting.value = false
  }
}

const typeLabels: Record<string, string> = {
  group: '编组',
  rect: '矩形',
  ellipse: '椭圆',
  line: '线条',
  polygon: '多边形',
  star: '星形',
  path: '路径',
  text: '文字',
  image: '图片',
  svg: '矢量图'
}

/** 各类型生效字段（group 仅尺寸；line 无填充区域；圆角仅矩形/图片/矢量图） */
const showStroke = computed(() => !!node.value && node.value.type !== 'group')
const showFill = computed(() => !!node.value && !['group', 'line'].includes(node.value.type))
const showCornerRadius = computed(() => ['rect', 'image', 'svg'].includes(node.value?.type ?? ''))
const isPolygon = computed(() => node.value?.type === 'polygon')

/** 数值字段读写代理：清空视为删除属性（写 undefined，保存后从节点移除该字段） */
const numField = (key: 'width' | 'height' | 'cornerRadius') =>
  computed({
    get: () => (typeof draft[key] === 'number' ? draft[key] : undefined),
    set: (v: unknown) => {
      draft[key] = typeof v === 'number' ? v : undefined
    }
  })
const widthNum = numField('width')
const heightNum = numField('height')
const cornerRadiusNum = numField('cornerRadius')

/** 布局关键字尺寸只读展示 */
const layoutSizeText = (v: number | CanvasLayoutSize | undefined): string =>
  v === 'fill_container' ? '撑满容器' : v === 'hug_contents' ? '包裹内容' : ''
</script>
<style scoped lang="less">
.element-property-panel {
  width: 290px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding-left: 8px;
  border-left: 1px solid var(--td-border-level-1-color);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 6px 2px 0;
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-placeholder);
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    margin-bottom: 16px;
    padding-right: 8px;
  }

  &__empty {
    padding: 24px 8px;
    text-align: center;
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-placeholder);
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 4px 0 8px;
  }

  &__type {
    flex: none;
    padding: 1px 8px;
    border-radius: var(--td-radius-default);
    background-color: var(--td-brand-color-light);
    color: var(--td-brand-color);
    font-size: var(--td-font-size-body-small);
  }

  &__name {
    flex: 1;
    min-width: 0;
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-primary);
  }

  &__group-title {
    margin: 8px 0;
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-placeholder);
  }

  &__form {
    :deep(.t-form__item) {
      margin-bottom: 12px;
    }
  }
}
</style>
