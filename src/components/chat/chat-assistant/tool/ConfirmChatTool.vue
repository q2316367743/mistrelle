<template>
  <div class="confirm-chat-tool">
    <template v-if="isInteractive">
      <div class="confirm-row">
        <ShieldErrorIcon class="confirm-icon" />
        <div class="confirm-info">
          <div class="confirm-title">{{ label }}</div>
          <div class="confirm-name">{{ toolCallName }}</div>
        </div>
      </div>
      <div v-if="formattedArgs" class="confirm-args">
        <pre>{{ formattedArgs }}</pre>
      </div>
      <div class="confirm-actions">
        <t-button theme="primary" size="small" @click="approve">批准执行</t-button>
        <t-button theme="default" variant="outline" size="small" @click="reject">拒绝</t-button>
      </div>
    </template>
    <div v-else-if="isExecuting" class="confirm-executing">
      <t-loading size="small" />
      <span>执行中…</span>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { computed, inject } from 'vue'
import type { PropType } from 'vue'
import type { ToolCallContent } from '@tdesign-vue-next/chat'
import { ShieldErrorIcon } from 'tdesign-icons-vue-next'
import { INTERACTIVE_KEY } from '@/modules/chat/agent/interactive'
import { toolMap } from '@/modules/tool'

const props = defineProps({
  content: {
    type: Object as PropType<ToolCallContent>,
    required: true
  }
})

const bridge = inject(INTERACTIVE_KEY)

const toolCallName = computed(() => props.content.data.toolCallName)
const label = computed(() => toolMap[toolCallName.value]?.label ?? toolCallName.value)

const formattedArgs = computed(() => {
  const raw = props.content.data.args
  if (!raw) return ''
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
})

const toolCallId = computed(() => props.content.data.toolCallId)

const matched = computed(() => bridge?.pending.value?.toolCallId === toolCallId.value)
const isInteractive = computed(
  () => (props.content.status === 'pending' || props.content.status === 'streaming') && !!bridge && matched.value
)
// 决策通过后、handler 执行期间的状态占位
const isExecuting = computed(() => {
  const s = props.content.status
  return (s === 'pending' || s === 'streaming') && !matched.value
})

const approve = () => {
  bridge?.resolve(toolCallId.value, true)
}

const reject = () => {
  bridge?.resolve(toolCallId.value, false)
}
</script>
<style scoped lang="less">
.confirm-chat-tool {
  margin: var(--td-comp-margin-xs) 0;
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-border);
  padding: var(--td-comp-paddingTB-s) var(--td-comp-paddingLR-s);

  .confirm-row {
    display: flex;
    align-items: center;
    gap: var(--td-comp-margin-s);
  }

  .confirm-icon {
    flex-shrink: 0;
    color: var(--td-warning-color);
    font-size: var(--td-font-size-title-medium);
  }

  .confirm-info {
    min-width: 0;
    flex: 1;
  }

  .confirm-title {
    font: var(--td-font-body-medium);
    color: var(--td-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .confirm-name {
    font: var(--td-font-body-small);
    font-family: var(--td-font-family-mono, 'Cascadia Code', 'Fira Code', 'Consolas', monospace);
    color: var(--td-text-color-placeholder);
  }

  .confirm-args {
    margin-top: var(--td-comp-margin-s);
    padding: var(--td-comp-paddingTB-xs) var(--td-comp-paddingLR-s);
    border-radius: var(--td-radius-small);
    background: var(--td-bg-color-secondary);
    font: var(--td-font-body-small);
    font-family: var(--td-font-family-mono, 'Cascadia Code', 'Fira Code', 'Consolas', monospace);
    color: var(--td-text-color-primary);
    max-height: 240px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-all;

    pre {
      margin: 0;
    }
  }

  .confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--td-comp-margin-s);
    margin-top: var(--td-comp-margin-s);
  }

  .confirm-executing {
    display: flex;
    align-items: center;
    gap: var(--td-comp-margin-s);
    color: var(--td-text-color-placeholder);
    font: var(--td-font-body-small);
  }
}
</style>
