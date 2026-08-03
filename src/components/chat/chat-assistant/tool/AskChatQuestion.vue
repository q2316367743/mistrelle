<template>
  <div class="ask-question-item">
    <div class="ask-question">
      <span class="ask-index">{{ index + 1 }}</span>
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
          v-model="custom"
          borderless
          class="ask-option-input"
          placeholder="自定义答案…"
          @click.stop
          @focus="onCustomFocus"
          @enter="onEnter"
        />
      </t-radio>
    </t-radio-group>
  </div>
</template>
<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import type { PropType } from 'vue'
import type { AskOption } from '@/modules/tool/components/ask'

// 自定义答案在单选组中的伪选项 key，保证与普通选项互斥
const CUSTOM_KEY = '__custom__'

const props = defineProps({
  question: {
    type: String,
    required: true
  },
  options: {
    type: Array as PropType<AskOption[]>,
    default: () => []
  },
  index: {
    type: Number,
    required: true
  }
})

const emit = defineEmits<{
  /** 答案变化时带出当前问题的已选答案字符串 */
  (e: 'change', answer: string): void
  /** 自定义输入框回车，请求父级提交整张问答卡片 */
  (e: 'submit'): void
}>()

const selected = ref(props.options.length > 0 ? props.options[0].key : CUSTOM_KEY)
const custom = ref('')

// 互斥：选中普通选项时清空自定义输入
watch(selected, (val) => {
  if (val !== CUSTOM_KEY) custom.value = ''
})
// 互斥：输入自定义答案时切到自定义选项
watch(custom, (val) => {
  if (val) selected.value = CUSTOM_KEY
})

// 当前问题的有效答案：普通选项取 label，自定义取输入文本
const answer = computed(() => {
  if (selected.value === CUSTOM_KEY) return custom.value.trim()
  return props.options.find((o) => o.key === selected.value)?.label ?? selected.value
})

let mounted = false
// 初始答案在挂载后上报一次（避免父组件渲染期改状态），后续变化实时上报
watch(answer, (val) => {
  if (mounted) emit('change', val)
})
onMounted(() => {
  mounted = true
  emit('change', answer.value)
})

const onCustomFocus = () => {
  selected.value = CUSTOM_KEY
}

const onEnter = () => {
  emit('submit')
}
</script>
<style scoped lang="less">
.ask-question-item {
  .ask-question {
    display: flex;
    align-items: flex-start;
    gap: var(--td-comp-margin-s);
    font: var(--td-font-body-medium);
    color: var(--td-text-color-primary);
  }

  .ask-index {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    margin-top: 1px;
    border-radius: var(--td-radius-small);
    background: var(--td-bg-color-secondary);
    color: var(--td-brand-color);
    font: var(--td-font-body-small);
    font-weight: 600;
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
}
</style>
