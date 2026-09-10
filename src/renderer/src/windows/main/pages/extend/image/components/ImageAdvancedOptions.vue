<template>
  <div class="advanced-options">
    <div class="field">
      <span class="field-label">质量</span>
      <t-select
        v-model="model.quality"
        class="field-control"
        :options="QUALITY_OPTIONS"
        clearable
        creatable
        placeholder="默认"
      />
    </div>
    <div class="field">
      <span class="field-label">背景</span>
      <t-select
        v-model="model.background"
        class="field-control"
        :options="BACKGROUND_OPTIONS"
        clearable
        placeholder="默认"
      />
    </div>
    <div class="field">
      <span class="field-label">输出格式</span>
      <t-select
        v-model="model.outputFormat"
        class="field-control"
        :options="FORMAT_OPTIONS"
        clearable
        placeholder="png"
      />
    </div>
    <div v-if="showCompression" class="field">
      <span class="field-label">压缩率</span>
      <t-slider v-model="model.outputCompression" class="field-slider" :min="0" :max="100" />
      <span class="field-value">{{ model.outputCompression ?? 75 }}</span>
    </div>
    <div class="field">
      <span class="field-label">内容审核</span>
      <t-select
        v-model="model.moderation"
        class="field-control"
        :options="MODERATION_OPTIONS"
        clearable
        placeholder="默认"
      />
    </div>
    <div class="field">
      <span class="field-label">NSFW 审核</span>
      <t-switch v-model="model.nsfwCheck" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import type { ImageAdvancedState } from '../image-page-utils'

/** 高级参数由父级持有（提交时统一取值），本组件只做字段编辑 */
const model = defineModel<ImageAdvancedState>({ required: true })

const QUALITY_OPTIONS = [
  { label: 'auto', value: 'auto' },
  { label: 'high', value: 'high' },
  { label: 'medium', value: 'medium' },
  { label: 'low', value: 'low' }
]
const BACKGROUND_OPTIONS = [
  { label: 'auto', value: 'auto' },
  { label: 'transparent', value: 'transparent' },
  { label: 'opaque', value: 'opaque' }
]
const FORMAT_OPTIONS = [
  { label: 'png', value: 'png' },
  { label: 'jpeg', value: 'jpeg' },
  { label: 'webp', value: 'webp' }
]
const MODERATION_OPTIONS = [
  { label: 'auto', value: 'auto' },
  { label: 'low', value: 'low' }
]

/** 压缩率仅对有损格式有意义 */
const showCompression = computed(() =>
  ['jpeg', 'jpg', 'webp'].includes((model.value.outputFormat ?? '').toLowerCase())
)
</script>

<style scoped lang="less">
.advanced-options {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  padding: 10px 12px;
  border: 1px dashed var(--td-component-border);
  border-radius: 8px;
  background: var(--td-bg-color-secondarycontainer);
}

.field {
  display: flex;
  align-items: center;
  gap: 6px;
}

.field-label {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.field-control {
  width: 110px;
}

.field-slider {
  width: 110px;
}

.field-value {
  min-width: 28px;
  font-size: 12px;
  color: var(--td-text-color-secondary);
}
</style>
