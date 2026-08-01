<template>
  <div class="ask-chat-tool">
    <div v-if="isInteractive" class="ask-body">
      <div class="ask-question">
        <HelpCircleIcon class="ask-icon" />
        <span class="ask-question-text">{{ question }}</span>
      </div>
      <div class="ask-options">
        <t-radio-group
          v-if="radioOptions.length > 0"
          v-model="selected"
          direction="vertical"
          :options="radioOptions"
        />
      </div>
      <t-input v-model="customAnswer" placeholder="或输入自定义答案" class="ask-custom" />
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
import { computed, inject, ref } from 'vue'
import type { PropType } from 'vue'
import type { ToolCallContent } from '@tdesign-vue-next/chat'
import { HelpCircleIcon } from 'tdesign-icons-vue-next'
import { INTERACTIVE_KEY } from '@/modules/chat/agent/interactive'

const props = defineProps({
  content: {
    type: Object as PropType<ToolCallContent>,
    required: true
  }
})

const bridge = inject(INTERACTIVE_KEY)

const args = computed<{ question?: string; options?: Array<{ key: string; label: string }> }>(() => {
  const raw = props.content.data.args
  if (!raw) return {}
  try {
    return JSON.parse(raw) as { question?: string; options?: Array<{ key: string; label: string }> }
  } catch {
    return {}
  }
})

const question = computed(() => args.value.question ?? '')
const options = computed(() => args.value.options ?? [])
const radioOptions = computed(() => options.value.map((o) => ({ label: o.label, value: o.key })))

const selected = ref('')
if (options.value.length > 0) selected.value = options.value[0].key
const customAnswer = ref('')

const toolCallId = computed(() => props.content.data.toolCallId)

const matched = computed(() => bridge?.pending.value?.toolCallId === toolCallId.value)
const isInteractive = computed(
  () => props.content.status === 'pending' && !!bridge && matched.value
)
const isWaiting = computed(() => {
  const s = props.content.status
  return (s === 'pending' || s === 'streaming') && !matched.value
})
const resultText = computed(() => props.content.data.result ?? '')

const submit = () => {
  if (!bridge) return
  const custom = customAnswer.value.trim()
  if (custom) {
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
    margin: var(--td-comp-margin-s) 0 0 var(--td-comp-margin-l);
  }

  .ask-custom {
    margin-top: var(--td-comp-margin-s);
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
