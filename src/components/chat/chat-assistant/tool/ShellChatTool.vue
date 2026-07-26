<template>
  <div class="chat-tool">
    <div class="tool-row">
      <TerminalIcon class="tool-icon" />
      <span class="tool-value tool-command">{{ commandText }}</span>
      <div class="tool-end">
        <t-loading v-if="isLoading" size="small" />
        <t-tag
          v-if="statusConfig"
          :theme="statusConfig.theme"
          variant="light-outline"
          size="small"
        >
          {{ statusConfig.label }}
        </t-tag>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { computed } from 'vue'
import type { ToolCallContent } from '@tdesign-vue-next/chat'
import { TerminalIcon } from 'tdesign-icons-vue-next'

const props = defineProps({
  content: {
    type: Object as PropType<ToolCallContent>,
    required: true
  }
})

function truncate(str: string, max = 80): string {
  if (!str) return ''
  return str.length > max ? str.slice(0, max) + '…' : str
}

const commandText = computed(() => {
  const { toolCallName, args } = props.content.data
  if (!args) return toolCallName
  try {
    const parsed = JSON.parse(args)
    switch (toolCallName) {
      case 'cli_run':
        return `${parsed.command} ${(parsed.args || []).join(' ')}`.trim()
      case 'js_run':
        return `node -e "${truncate(parsed.script)}"`
      case 'python_run':
        return parsed.file
          ? `python ${parsed.file}`
          : `python -c "${truncate(parsed.code)}"`
      case 'node_run':
        return parsed.file
          ? `node ${parsed.file}`
          : `node -e "${truncate(parsed.code)}"`
      case 'git_exec':
        return `git ${(parsed.args || []).join(' ')}`
      default:
        return toolCallName
    }
  } catch {
    return toolCallName
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

.tool-command {
  font-family: var(--td-font-family-mono, 'Cascadia Code', 'Fira Code', 'Consolas', monospace);
}

.tool-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font: var(--td-font-body-small);
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
