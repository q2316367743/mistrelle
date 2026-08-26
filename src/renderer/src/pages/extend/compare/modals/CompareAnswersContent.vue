<template>
  <div class="answers-content">
    <div v-if="base" class="question-block">
      <t-tag size="small" variant="outline">{{ base.tag }}</t-tag>
      <div class="question-text">{{ base.question }}</div>
      <div class="reference-text">参考答案：{{ base.reference }}</div>
    </div>

    <div class="answer-list">
      <div
        v-for="item in answers"
        :key="item.modelName"
        :class="['answer-card', `answer-card--${item.tone}`]"
      >
        <div class="card-head">
          <span class="model-name">{{ item.modelName }}</span>
          <t-tag size="small" :theme="item.theme">{{ item.mark }}</t-tag>
        </div>
        <div v-if="item.error" class="card-error">请求失败：{{ item.error }}</div>
        <div v-else class="card-answer">{{ item.answer || '（空回答）' }}</div>
      </div>
    </div>

    <div class="content-actions">
      <t-button theme="default" variant="base" @click="emit('close')">关闭</t-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { CompareRecord } from '../compare-types'

const props = defineProps<{
  record: CompareRecord
  questionKey: string
}>()

const emit = defineEmits<{ close: [] }>()

const base = computed(() => {
  for (const result of props.record.results) {
    const item = result.questions.find((q) => q.key === props.questionKey)
    if (item) return item
  }
  return null
})

interface AnswerView {
  modelName: string
  mark: string
  theme: 'success' | 'danger' | 'warning' | 'default'
  tone: 'pass' | 'fail' | 'warn' | 'none'
  answer: string
  error?: string
}

const answers = computed<AnswerView[]>(() =>
  props.record.results.map((result) => {
    const item = result.questions.find((q) => q.key === props.questionKey)
    const modelName = result.target.modelName || result.target.modelId
    if (!item) {
      return { modelName, mark: '未执行', theme: 'default', tone: 'none', answer: '' }
    }
    if (item.error) {
      return { modelName, mark: '请求失败', theme: 'danger', tone: 'warn', answer: '', error: item.error }
    }
    const mark = item.truncated ? '截断' : item.pass === true ? '通过' : item.pass === false ? '未通过' : '未判定'
    const theme = item.pass === true ? 'success' : item.pass === false ? 'danger' : 'warning'
    const tone = item.pass === true ? 'pass' : item.pass === false ? 'fail' : 'warn'
    return { modelName, mark, theme, tone, answer: item.answer }
  })
)
</script>

<style scoped lang="less">
.answers-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 62vh;
  overflow-y: auto;
}

.question-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 14px;
  border: 1px solid var(--td-component-border);
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-container-hover);

  .question-text {
    font-size: 13px;
    color: var(--td-text-color-primary);
    line-height: 1.6;
  }

  .reference-text {
    font-size: 12px;
    color: var(--td-text-color-secondary);
  }
}

.answer-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.answer-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 14px;
  border: 1px solid var(--td-component-border);
  border-left-width: 3px;
  border-radius: var(--td-radius-medium);

  &--pass {
    border-left-color: var(--td-success-color);
  }

  &--fail {
    border-left-color: var(--td-error-color);
  }

  &--warn {
    border-left-color: var(--td-warning-color);
  }

  &--none {
    border-left-color: var(--td-component-border);
  }

  .card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;

    .model-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--td-text-color-primary);
    }
  }

  .card-error {
    font-size: 12px;
    color: var(--td-error-color);
  }

  .card-answer {
    font-size: 12.5px;
    color: var(--td-text-color-primary);
    line-height: 1.6;
    word-break: break-word;
    white-space: pre-wrap;
  }
}

.content-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
