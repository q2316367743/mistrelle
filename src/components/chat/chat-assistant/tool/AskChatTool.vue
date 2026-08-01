<template>
  <div class="ask-chat-tool">
    <div v-if="isInteractive" class="ask-body">
      <div class="ask-question">
        <HelpCircleIcon class="ask-icon" />
        <span class="ask-question-text">{{ question }}</span>
      </div>
      <t-radio-group v-model="selected" direction="vertical" class="ask-options">
        <t-radio
          v-for="opt in options"
          :key="opt.key"
          :value="opt.key"
          class="ask-option"
        >
          <span class="ask-option-label">{{ opt.label }}</span>
          <span v-if="opt.description" class="ask-option-desc">{{ opt.description }}</span>
        </t-radio>
        <t-radio :value="CUSTOM_KEY" class="ask-option ask-option--custom">
          <t-input
            v-model="customAnswer"
            borderless
            class="ask-option-input"
            placeholder="自定义答案…"
            @click.stop
            @focus="onCustomFocus"
            @enter="submit"
          />
        </t-radio>
      </t-radio-group>
      <div class="ask-actions">
        <t-button theme="primary" size="small" @click="submit">提交</t-button>
        <t-button theme="default" variant="text" size="small" @click="skip">跳过</t-button>
      </div>
    </div>
    <div v-else-if="isWaiting" class="ask-waiting">
      <t-loading size="small" />
      <span>等待用户回答…</span>
    </div>
    <div v-else-if="resultText" class="ask-result">
      <HelpCircleIcon class="ask-icon" />
      <span class="ask-result-text">{{ resultText }}</span>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { computed, inject, ref, watch } from 'vue'
import type { PropType } from 'vue'
import type { ToolCallContent } from '@tdesign-vue-next/chat'
import { HelpCircleIcon } from 'tdesign-icons-vue-next'
import { INTERACTIVE_KEY } from '@/modules/chat/agent/interactive'

// 自定义答案在单选组中的伪选项 key，保证与普通选项互斥
const CUSTOM_KEY = '__custom__'

const props = defineProps({
  content: {
    type: Object as PropType<ToolCallContent>,
    required: true
  }
})

const bridge = inject(INTERACTIVE_KEY)

const args = computed<{
  question?: string
  options?: Array<{ key: string; label: string; description?: string }>
}>(() => {
  const raw = props.content.data.args
  if (!raw) return {}
  try {
    return JSON.parse(raw) as {
      question?: string
      options?: Array<{ key: string; label: string; description?: string }>
    }
  } catch {
    return {}
  }
})

const question = computed(() => args.value.question ?? '')
const options = computed(() => args.value.options ?? [])

const selected = ref('')
if (options.value.length > 0) selected.value = options.value[0].key
const customAnswer = ref('')

// 互斥：选中普通选项时清空自定义输入
watch(selected, (val) => {
  if (val !== CUSTOM_KEY && customAnswer.value) customAnswer.value = ''
})
// 互斥：输入自定义答案时切到自定义选项
watch(customAnswer, (val) => {
  if (val) selected.value = CUSTOM_KEY
})

const onCustomFocus = () => {
  selected.value = CUSTOM_KEY
}

const toolCallId = computed(() => props.content.data.toolCallId)

const matched = computed(() => bridge?.pending.value?.toolCallId === toolCallId.value)
// 流结束后 setAssistantStatus 会把 toolcall status 置为 streaming，等待期需同时认 pending/streaming
const isInteractive = computed(
  () => (props.content.status === 'pending' || props.content.status === 'streaming') && !!bridge && matched.value
)
const isWaiting = computed(() => {
  const s = props.content.status
  return (s === 'pending' || s === 'streaming') && !matched.value
})
const resultText = computed(() => props.content.data.result ?? '')

const submit = () => {
  if (!bridge) return
  if (selected.value === CUSTOM_KEY) {
    const custom = customAnswer.value.trim()
    if (!custom) return
    bridge.resolve(toolCallId.value, custom)
    return
  }
  const picked = options.value.find((o) => o.key === selected.value)
  if (!picked) return
  bridge.resolve(toolCallId.value, picked.label)
}

const skip = () => {
  bridge?.resolve(toolCallId.value, null)
}
</script>
<style scoped lang="less">
.ask-chat-tool {
  margin: var(--td-comp-margin-xs) 0;
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-border);
  padding: var(--td-comp-paddingTB-s) var(--td-comp-paddingLR-s);

  .ask-question {
    display: flex;
    align-items: flex-start;
    gap: var(--td-comp-margin-s);
    font: var(--td-font-body-medium);
    color: var(--td-text-color-primary);
  }

  .ask-icon {
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--td-brand-color);
    font-size: var(--td-font-size-body-large);
  }

  .ask-question-text {
    white-space: pre-wrap;
    word-break: break-word;
  }

  .ask-options {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: var(--td-comp-margin-s) 0 0;
    width: 100%;
  }

  // Fluent RadioButtons：整行可点、hover/选中态背景
  :deep(.t-radio) {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    width: 100%;
    padding: 7px 10px;
    border-radius: var(--td-radius-small);
    cursor: pointer;
    transition: background-color 100ms ease-out;

    &:hover {
      background: var(--td-bg-color-container-hover);
    }

    &.t-is-checked {
      background: var(--td-brand-color-light);
    }

    .t-radio__input {
      flex-shrink: 0;
      margin-top: 3px;
    }

    .t-radio__label {
      flex: 1;
      min-width: 0;
      color: var(--td-text-color-primary);
      font: var(--td-font-body-medium);
    }
  }

  .ask-option-label {
    display: block;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .ask-option-desc {
    display: block;
    margin-top: 2px;
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .ask-option--custom {
    align-items: center;
  }

  :deep(.ask-option-input) {
    width: 100%;
  }

  .ask-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--td-comp-margin-s);
    margin-top: var(--td-comp-margin-s);
  }

  .ask-waiting {
    display: flex;
    align-items: center;
    gap: var(--td-comp-margin-s);
    color: var(--td-text-color-placeholder);
    font: var(--td-font-body-small);
  }

  .ask-result {
    display: flex;
    align-items: flex-start;
    gap: var(--td-comp-margin-s);
    color: var(--td-text-color-secondary);
    font: var(--td-font-body-small);

    .ask-icon {
      color: var(--td-text-color-placeholder);
      margin-top: 0;
    }

    .ask-result-text {
      white-space: pre-wrap;
      word-break: break-word;
    }
  }
}
</style>
