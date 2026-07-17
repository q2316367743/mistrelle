<template>
  <div class="trace-card">
    <div class="trace-content">{{ detail.content }}</div>
    <div class="trace-actions">
      <t-popconfirm content="确定删除这条碎碎念吗？" @confirm="handleDelete">
        <t-button theme="danger" variant="text" shape="square">
          <template #icon>
            <delete-icon />
          </template>
        </t-button>
      </t-popconfirm>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { DeleteIcon } from 'tdesign-icons-vue-next'
import { useNoteTraceStore } from '@/store'

const props = defineProps<{
  trace: number
}>()

const emit = defineEmits<{
  delete: [id: number]
}>()

const detail = computedAsync<{ content: string }>(
  () => {
    return useNoteTraceStore().getDetailById(props.trace)
  },
  { content: '' }
)

const handleDelete = () => {
  emit('delete', props.trace)
}
</script>
<style scoped lang="less">
.trace-card {
  position: relative;
  padding: 12px 16px;
  border-radius: var(--fluent-radius-smooth);
  background: var(--fluent-card-bg);
  border: 1px solid var(--fluent-card-border);
  box-shadow: var(--fluent-card-shadow);
  transition:
    box-shadow var(--fluent-transition-fast),
    background var(--fluent-transition-fast);

  &:hover {
    background: var(--fluent-card-bg-hover);
    box-shadow: var(--fluent-card-shadow-hover);
  }
}

.trace-content {
  padding-right: 32px;
  color: var(--td-text-color-primary);
  font: var(--td-font-body-medium);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.trace-actions {
  position: absolute;
  top: 8px;
  right: 8px;
}
</style>
