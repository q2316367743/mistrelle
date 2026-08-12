<template>
  <div class="chat-tool">
    <div class="tool-row">
      <component :is="skillIconComponent" class="tool-icon" />
      <span class="tool-op">{{ skillLabel }}</span>
      <span class="tool-value">{{ skillValue }}</span>
      <div class="tool-end">
        <t-loading v-if="isLoading" size="small" />
        <t-tag v-if="statusConfig" :theme="statusConfig.theme" variant="light-outline" size="small">
          {{ statusConfig.label }}
        </t-tag>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import type { ToolCallContent } from '@tdesign-vue-next/chat'
import { LightbulbIcon, FileIcon } from 'tdesign-icons-vue-next'

const props = defineProps({
  content: {
    type: Object as PropType<ToolCallContent>,
    required: true
  }
})

const skillIconComponent = computed<Component>(() => {
  return props.content.data.toolCallName === 'load_skill' ? LightbulbIcon : FileIcon
})

const skillLabel = computed(() => {
  return props.content.data.toolCallName === 'load_skill' ? '加载技能' : '读取'
})

const skillValue = computed(() => {
  const { toolCallName, args } = props.content.data
  if (!args) return ''
  try {
    const parsed = JSON.parse(args)
    if (toolCallName === 'load_skill') return parsed.name ?? ''
    return parsed.path ?? ''
  } catch {
    return ''
  }
})

interface StatusConfig {
  theme: 'default' | 'primary' | 'success' | 'warning' | 'danger'
  label: string
}

const statusConfig = computed<StatusConfig | null>(() => {
  const map: Record<string, StatusConfig> = {
    pending: { theme: 'default', label: '等待中' },
    streaming: { theme: 'primary', label: '执行中' },
    complete: { theme: 'success', label: '完成' },
    stop: { theme: 'default', label: '已停止' },
    error: { theme: 'danger', label: '错误' }
  }
  return props.content.status ? (map[props.content.status] ?? null) : null
})

const isLoading = computed(() => {
  const s = props.content.status
  return s === 'pending' || s === 'streaming'
})
</script>
<style scoped lang="less">
.chat-tool {
  margin: var(--td-comp-margin-xs) 0;
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-border);
  overflow: hidden;
}

.tool-row {
  display: flex;
  align-items: center;
  gap: var(--td-comp-margin-s);
  padding: var(--td-comp-paddingTB-xs) var(--td-comp-paddingLR-s);
  min-width: 0;
}

.tool-icon {
  flex-shrink: 0;
  color: var(--td-text-color-placeholder);
}

.tool-op {
  flex-shrink: 0;
  color: var(--td-brand-color);
  font-weight: var(--td-font-weight-medium, 500);
  font: var(--td-font-body-small);
}

.tool-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font: var(--td-font-body-small);
  font-family: var(--td-font-family-mono, 'Cascadia Code', 'Fira Code', 'Consolas', monospace);
  color: var(--td-text-color-primary);
}

.tool-end {
  display: flex;
  align-items: center;
  gap: var(--td-comp-margin-s);
  flex-shrink: 0;
  margin-left: auto;
}
</style>
