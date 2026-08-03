<template>
  <div class="ask-chat-tool">
    <div v-if="isInteractive" class="ask-body">
      <ask-chat-question
        v-for="(item, idx) in items"
        :key="idx"
        :index="idx"
        :question="item.question"
        :options="item.options"
        @change="onAnswer(idx, $event)"
        @submit="submit"
      />
      <div class="ask-actions">
        <t-button theme="primary" size="small" :disabled="!allAnswered" @click="submit">
          提交
        </t-button>
        <t-button theme="default" variant="text" size="small" @click="skip">跳过</t-button>
      </div>
    </div>
    <div v-else-if="isWaiting" class="ask-waiting">
      <t-loading size="small" />
      <span>等待用户回答…</span>
    </div>
    <div v-else-if="resultItems.length" class="ask-result">
      <div v-for="(item, idx) in resultItems" :key="idx" class="ask-result-item">
        <div class="ask-result-question">
          <CheckCircleIcon class="ask-result-icon" />
          <span class="ask-result-question-text">{{ item.question }}</span>
        </div>
        <div class="ask-result-answer">{{ item.answer || '（未作答）' }}</div>
      </div>
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
import { CheckCircleIcon, HelpCircleIcon } from 'tdesign-icons-vue-next'
import { INTERACTIVE_KEY } from '@/modules/chat/agent/interactive'
import {
  normalizeAskArgs,
  type AskAnswerItem,
  type AskOption
} from '@/modules/tool/components/ask'
import AskChatQuestion from '@/components/chat/chat-assistant/tool/AskChatQuestion.vue'

const props = defineProps({
  content: {
    type: Object as PropType<ToolCallContent>,
    required: true
  }
})

const bridge = inject(INTERACTIVE_KEY)

const args = computed(() => {
  const raw = props.content.data.args
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
})

const items = computed<Array<{ question: string; options: AskOption[] }>>(() =>
  normalizeAskArgs(args.value)
)

// 各问题的答案，与 items 按索引对应；由子组件 change 事件带出
const answers = ref<string[]>([])
const onAnswer = (idx: number, value: string) => {
  answers.value[idx] = value
}
const allAnswered = computed(
  () =>
    items.value.length > 0 &&
    items.value.every((_, i) => (answers.value[i] ?? '').trim() !== '')
)

const toolCallId = computed(() => props.content.data.toolCallId)

const matched = computed(() => bridge?.pending.value?.toolCallId === toolCallId.value)
// 流结束后 setAssistantStatus 会把 toolcall status 置为 streaming，等待期需同时认 pending/streaming
const isInteractive = computed(
  () =>
    (props.content.status === 'pending' || props.content.status === 'streaming') &&
    !!bridge &&
    matched.value
)
const isWaiting = computed(() => {
  const s = props.content.status
  return (s === 'pending' || s === 'streaming') && !matched.value
})
const resultText = computed(() => props.content.data.result ?? '')

// 结构化问答对：agentTools 作答后写入 ext.askItems，旧数据无则回退显示 resultText
const resultItems = computed<AskAnswerItem[]>(() => {
  const raw = props.content.ext?.askItems
  return Array.isArray(raw) ? (raw as AskAnswerItem[]) : []
})

const submit = () => {
  if (!bridge || !allAnswered.value) return
  bridge.resolve(toolCallId.value, answers.value.slice(0, items.value.length))
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

  .ask-body {
    display: flex;
    flex-direction: column;
    gap: var(--td-comp-margin-m);
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
    flex-direction: column;
    gap: var(--td-comp-margin-s);
    font: var(--td-font-body-medium);
    color: var(--td-text-color-primary);

    .ask-result-question {
      display: flex;
      align-items: flex-start;
      gap: var(--td-comp-margin-s);
      color: var(--td-text-color-secondary);
      font: var(--td-font-body-medium);
    }

    .ask-result-icon {
      flex-shrink: 0;
      margin-top: 2px;
      color: var(--td-brand-color);
      font-size: var(--td-font-size-body-large);
    }

    .ask-result-question-text {
      white-space: pre-wrap;
      word-break: break-word;
    }

    .ask-result-answer {
      margin-left: calc(var(--td-comp-margin-s) + var(--td-font-size-body-large));
      padding: var(--td-comp-paddingTB-xs) var(--td-comp-paddingLR-s);
      border-radius: var(--td-radius-small);
      background: var(--td-bg-color-container-hover);
      color: var(--td-text-color-primary);
      font: var(--td-font-body-medium);
      white-space: pre-wrap;
      word-break: break-word;
    }
  }

  .ask-icon {
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--td-text-color-placeholder);
    font-size: var(--td-font-size-body-large);
  }

  .ask-result-text {
    color: var(--td-text-color-secondary);
    font: var(--td-font-body-small);
    white-space: pre-wrap;
    word-break: break-word;
  }
}
</style>
