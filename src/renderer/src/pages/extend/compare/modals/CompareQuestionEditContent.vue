<template>
  <div class="edit-content">
    <div class="form-row">
      <span class="field-label">分类</span>
      <t-input v-model="form.tag" class="field-control" placeholder="如 数学 / 代码 / 自定义分类" />
    </div>
    <div class="form-row">
      <span class="field-label">题目</span>
      <t-textarea
        v-model="form.question"
        class="field-control"
        :autosize="{ minRows: 2, maxRows: 6 }"
        placeholder="题面（temperature=0 发给模型）"
      />
    </div>
    <div class="form-row">
      <span class="field-label">参考答案</span>
      <t-input v-model="form.reference" class="field-control" placeholder="供人工比对" />
    </div>
    <div class="form-row">
      <span class="field-label">关键词</span>
      <t-input
        v-model="form.answerKeysText"
        class="field-control"
        placeholder="判分关键词，逗号分隔，须全部包含才判对"
      />
    </div>
    <div class="form-row">
      <span class="field-label">正则校验</span>
      <t-input
        v-model="form.pattern"
        class="field-control"
        placeholder="可选，额外正则校验（如 JSON 格式题）"
      />
    </div>

    <div class="content-actions">
      <t-button variant="outline" :disabled="saving" @click="emit('close')">取消</t-button>
      <t-button theme="primary" :loading="saving" :disabled="!formValid" @click="handleSave">
        保存
      </t-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useModelCompare } from '../useModelCompare'

const props = defineProps<{
  /** null = 新增 */
  question: CompareQuestionInput | null
  /** 新增时的排序位（列表尾部 orderIndex + 1） */
  nextOrder: number
}>()

const emit = defineEmits<{ close: [] }>()

const { upsertQuestion } = useModelCompare()

const form = reactive({
  tag: (props.question?.tag ?? '').trim(),
  question: (props.question?.question ?? '').trim(),
  reference: (props.question?.reference ?? '').trim(),
  answerKeysText: (props.question?.answerKeys ?? []).join('，'),
  pattern: (props.question?.pattern ?? '').trim()
})

const formValid = computed(
  () =>
    form.tag.length > 0 &&
    form.question.length > 0 &&
    form.reference.length > 0 &&
    parseKeys(form.answerKeysText).length > 0
)

const parseKeys = (text: string): string[] =>
  text
    .split(/[,，]/)
    .map((it) => it.trim())
    .filter((it) => it.length > 0)

const saving = ref(false)

const handleSave = async (): Promise<void> => {
  if (!formValid.value) return
  const pattern = form.pattern
  const question: CompareQuestionInput = {
    key: props.question?.key ?? `custom-${Date.now()}`,
    tag: form.tag,
    orderIndex: props.question?.orderIndex ?? props.nextOrder,
    enable: props.question?.enable ?? true,
    question: form.question,
    reference: form.reference,
    answerKeys: parseKeys(form.answerKeysText),
    pattern: pattern || null,
    note: props.question?.note ?? null
  }
  saving.value = true
  try {
    await upsertQuestion(question)
    emit('close')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="less">
.edit-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;

  .field-label {
    flex-shrink: 0;
    width: 60px;
    font-size: 12.5px;
    color: var(--td-text-color-secondary);
    text-align: right;
    line-height: 30px;
  }

  .field-control {
    flex: 1;
    min-width: 0;
  }
}

.content-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}
</style>