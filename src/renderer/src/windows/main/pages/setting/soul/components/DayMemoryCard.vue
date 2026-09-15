<template>
  <section class="memory-card">
    <div class="memory-card__header">
      <t-select
        class="w-200px"
        :value="date"
        :options="options"
        placeholder="选择日期"
        :disabled="options.length === 0"
        @change="onDateChange"
      />
      <t-button
        theme="danger"
        variant="outline"
        :disabled="!enabled || !date"
        @click="emit('remove')"
      >
        删除当日
      </t-button>
    </div>
    <t-textarea
      :value="content"
      class="memory-card__editor"
      :autosize="{ minRows: 4, maxRows: 12 }"
      readonly
      :placeholder="options.length === 0 ? '暂无每日记忆' : '选择日期查看'"
    />
  </section>
</template>
<script lang="ts" setup>
import type { SelectValue } from 'tdesign-vue-next'

defineProps<{
  /** 选中的日期（YYYY-MM-DD） */
  date: string
  options: Array<{ label: string; value: string }>
  enabled: boolean
  content: string
}>()

const emit = defineEmits<{
  'update:date': [string]
  remove: []
}>()

const onDateChange = (value: SelectValue): void => {
  emit('update:date', typeof value === 'string' ? value : '')
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
  gap: 8px;
  margin-bottom: 10px;
}

.memory-card__editor {
  font-family: var(--td-font-family);
}
</style>
