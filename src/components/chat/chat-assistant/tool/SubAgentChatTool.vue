<template>
  <div class="sub-agent-tool" @click="handleClick">
    <div class="tool-row">
      <div class="tool-icon">
        <t-loading v-if="isLoading" size="small" />
        <UserIcon v-else :class="['tool-agent-icon', { error: content.status === 'error' }]" />
      </div>
      <div class="tool-main">
        <div class="tool-title">子 Agent</div>
        <div v-if="taskText" class="tool-task ellipsis">{{ taskText }}</div>
      </div>
      <div class="tool-end">
        <t-tag v-if="statusConfig" :theme="statusConfig.theme" variant="light-outline" size="small">
          {{ statusConfig.label }}
        </t-tag>
        <ChevronRightIcon class="tool-arrow" />
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import type { ToolCallContent } from '@tdesign-vue-next/chat'
import { ChevronRightIcon, UserIcon } from 'tdesign-icons-vue-next'

const props = defineProps<{
  content: ToolCallContent
}>()

const emit = defineEmits<{
  (e: 'view', subAgentId: string): void
}>()

/** 从 toolcall args 中解析任务描述 */
const taskText = computed(() => {
  const raw = props.content.data.args
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw) as { task?: string }
    return parsed.task ?? ''
  } catch {
    return ''
  }
})

const statusConfig = computed(() => {
  const map: Record<string, { theme: 'default' | 'primary' | 'success' | 'danger'; label: string }> = {
    pending: { theme: 'default', label: '等待中' },
    streaming: { theme: 'primary', label: '执行中' },
    complete: { theme: 'success', label: '已完成' },
    stop: { theme: 'default', label: '已停止' },
    error: { theme: 'danger', label: '出错' }
  }
  return props.content.status ? (map[props.content.status] ?? null) : null
})

const isLoading = computed(() => {
  const s = props.content.status
  return s === 'pending' || s === 'streaming'
})

const handleClick = () => {
  const subAgentId = props.content.ext?.subAgentId
  if (subAgentId) emit('view', subAgentId)
}
</script>
<style scoped lang="less">
.sub-agent-tool {
  margin: var(--td-comp-margin-xs) 0;
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-border);
  overflow: hidden;

  &:hover {
    border-color: var(--td-brand-color);
  }
}

.tool-row {
  display: flex;
  align-items: center;
  gap: var(--td-comp-margin-s);
  padding: var(--td-comp-paddingTB-xs) var(--td-comp-paddingLR-s);
  cursor: pointer;
  user-select: none;
}

.tool-icon {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.tool-agent-icon {
  font-size: var(--td-font-size-body-large);
  color: var(--td-brand-color);

  &.error {
    color: var(--td-error-color);
  }
}

.tool-main {
  flex: 1;
  min-width: 0;
}

.tool-title {
  font: var(--td-font-body-medium);
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.tool-task {
  font: var(--td-font-body-small);
  color: var(--td-text-color-secondary);
  margin-top: 2px;
}

.tool-end {
  display: flex;
  align-items: center;
  gap: var(--td-comp-margin-s);
  flex-shrink: 0;
  margin-left: auto;
}

.tool-arrow {
  color: var(--td-text-color-placeholder);
  font-size: var(--td-font-size-body-large);
}
</style>
