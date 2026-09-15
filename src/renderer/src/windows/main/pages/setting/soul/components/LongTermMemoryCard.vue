<template>
  <section class="memory-card">
    <div class="memory-card__header">
      <span class="memory-card__tip">
        MEMORY.md · 跨会话持久保留，整理时自动去重淘汰，上限 {{ maxChars }} 字（{{ limitsLabel }}）
      </span>
      <span class="memory-card__count" :class="{ 'is-over': draft.length > maxChars }">
        {{ draft.length }} / {{ maxChars }}
      </span>
    </div>
    <t-textarea
      :value="draft"
      class="memory-card__editor"
      :autosize="{ minRows: 6, maxRows: 18 }"
      :placeholder="placeholder"
      :disabled="!enabled"
      @change="onChange"
    />
    <div class="memory-card__footer">
      <t-button
        size="small"
        theme="primary"
        :loading="saving"
        :disabled="!enabled || !dirty"
        @click="emit('save')"
      >
        保存
      </t-button>
    </div>
  </section>
</template>
<script lang="ts" setup>
import type { TextareaValue } from 'tdesign-vue-next'

const props = defineProps<{
  /** 长期记忆草稿 */
  draft: string
  maxChars: number
  limitsLabel: string
  enabled: boolean
  saving: boolean
  /** 草稿是否与已保存内容不同 */
  dirty: boolean
}>()

const emit = defineEmits<{
  'update:draft': [string]
  save: []
}>()

const placeholder = computed(() =>
  props.enabled ? '暂无长期记忆，可通过「立即整理」或对话积累生成' : '记忆系统未启用'
)

const onChange = (value: TextareaValue): void => {
  emit('update:draft', typeof value === 'string' ? value : String(value ?? ''))
}
</script>
<style scoped lang="less">
.memory-card {
  padding: 16px;
  background: var(--fluent-card-bg);
  border: 1px solid var(--fluent-card-border);
  border-radius: var(--fluent-radius-card);
  box-shadow: var(--fluent-elevation-1);
}

.memory-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.memory-card__tip {
  font: var(--td-font-body-small);
  color: var(--td-text-color-placeholder);
}

.memory-card__count {
  flex: none;
  font: var(--td-font-body-small);
  color: var(--td-text-color-placeholder);

  &.is-over {
    color: var(--td-error-color);
  }
}

.memory-card__editor {
  font-family: var(--td-font-family);
}

.memory-card__footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}
</style>
