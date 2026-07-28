<template>
  <div class="chat-tool" :class="{ 'is-expanded': expanded }">
    <div class="tool-row" @click="toggle">
      <ToolsIcon class="tool-icon" />
      <ChevronRightIcon v-if="!expanded" class="tool-chevron" />
      <ChevronDownIcon v-else class="tool-chevron" />
      <span class="tool-value">{{ content.data.toolCallName }}</span>
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
    <div v-if="expanded" class="tool-detail">
      <div v-if="content.data.args" class="detail-section">
        <div class="detail-label">参数</div>
        <pre class="detail-content"><code>{{ formattedArgs }}</code></pre>
      </div>
      <div v-if="content.data.result" class="detail-section">
        <div class="detail-label">结果</div>
        <pre class="detail-content"><code>{{ content.data.result }}</code></pre>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { computed, ref } from 'vue'
import type { ToolCallContent } from '@tdesign-vue-next/chat'
import { ChevronDownIcon, ChevronRightIcon, ToolsIcon } from 'tdesign-icons-vue-next'

const props = defineProps({
  content: {
    type: Object as PropType<ToolCallContent>,
    required: true
  }
})

const expanded = ref(false)
const toggle = () => { expanded.value = !expanded.value }

const formattedArgs = computed(() => {
  const raw = props.content.data.args
  if (!raw) return ''
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
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

  &.is-expanded {
    border-color: var(--td-component-stroke);
  }
}

.tool-row {
  display: flex;
  align-items: center;
  gap: var(--td-comp-margin-s);
  padding: var(--td-comp-paddingTB-xs) var(--td-comp-paddingLR-s);
  min-width: 0;
  cursor: pointer;
  user-select: none;
}

.tool-icon,
.tool-chevron {
  flex-shrink: 0;
  color: var(--td-text-color-placeholder);
  font-size: var(--td-font-size-body-large);
}

.tool-icon {
  display: inline-flex;
}

.tool-chevron {
  display: none;
}

.tool-row:hover .tool-icon {
  display: none;
}

.tool-row:hover .tool-chevron {
  display: inline-flex;
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

.tool-detail {
  border-top: 1px solid var(--td-component-border);
}

.detail-section {
  padding: var(--td-comp-paddingTB-xs) var(--td-comp-paddingLR-s);

  + .detail-section {
    border-top: 1px solid var(--td-component-border);
  }
}

.detail-label {
  font: var(--td-font-body-small);
  color: var(--td-text-color-placeholder);
  margin-bottom: var(--td-comp-margin-xs);
}

.detail-content {
  margin: 0;
  padding: var(--td-comp-paddingTB-xs) var(--td-comp-paddingLR-s);
  border-radius: var(--td-radius-small);
  background: var(--td-bg-color-secondary);
  font: var(--td-font-body-small);
  font-family: var(--td-font-family-mono, 'Cascadia Code', 'Fira Code', 'Consolas', monospace);
  color: var(--td-text-color-primary);
  max-height: 320px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
