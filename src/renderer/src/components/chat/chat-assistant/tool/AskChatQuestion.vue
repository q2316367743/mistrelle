<template>
  <div class="ask-question-item">
    <div class="ask-question">
      <span class="ask-index">{{ index + 1 }}</span>
      <span class="ask-question-text">{{ question }}</span>
    </div>
    <t-radio-group v-if="!multiple" v-model="selected" direction="vertical" class="ask-options">
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
    <t-checkbox-group v-else v-model="checkedKeys" class="ask-options">
      <t-checkbox
        v-for="opt in options"
        :key="opt.key"
        :value="opt.key"
        class="ask-option"
      >
        <span class="ask-option-label">{{ opt.label }}</span>
        <span v-if="opt.description" class="ask-option-desc">{{ opt.description }}</span>
      </t-checkbox>
      <t-checkbox :value="CUSTOM_KEY" class="ask-option ask-option--custom">
        <t-input
          ref="customInputRef"
          v-model="custom"
          borderless
          class="ask-option-input"
          placeholder="自定义答案…"
          @click.stop
          @focus="onCustomFocus"
          @enter="onEnter"
        />
      </t-checkbox>
    </t-checkbox-group>
  </div>
</template>
<script lang="ts" setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { PropType } from 'vue'
import type { AskOption } from '@/windows/main/modules/tool/components/ask'

// 自定义答案的伪选项 key：单选组中与普通选项互斥，多选组中作为可勾选的附加项
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
  },
  multiple: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits<{
  /** 答案变化时带出当前问题的已选答案字符串（多选为「、」连接） */
  (e: 'change', answer: string): void
  /** 自定义输入框回车，请求父级提交整张问答卡片 */
  (e: 'submit'): void
}>()

// 单选：当前选中 key（缺省选第一个选项）；多选：勾选的 key 集合（可含自定义伪选项）
const selected = ref(props.options.length > 0 ? props.options[0].key : CUSTOM_KEY)
const checkedKeys = ref<string[]>([])
const custom = ref('')
const customInputRef = ref<{ focus: () => void } | null>(null)

// 单选互斥：选中普通选项时清空自定义输入
watch(selected, (val) => {
  if (val !== CUSTOM_KEY) custom.value = ''
})

// 多选：勾中自定义项时聚焦输入框，取消勾选则清空文本
watch(checkedKeys, (keys) => {
  if (keys.includes(CUSTOM_KEY)) nextTick(() => customInputRef.value?.focus())
  else custom.value = ''
})

// 输入自定义答案：单选切到自定义选项；多选自动勾上自定义项
watch(custom, (val) => {
  if (!val) return
  if (props.multiple) {
    if (!checkedKeys.value.includes(CUSTOM_KEY)) {
      checkedKeys.value = [...checkedKeys.value, CUSTOM_KEY]
    }
  } else {
    selected.value = CUSTOM_KEY
  }
})

// 当前问题的有效答案：多选按选项顺序拼接已选 labels 与自定义文本；单选普通选项取 label，自定义取输入文本
const answer = computed(() => {
  if (props.multiple) {
    const labels = props.options
      .filter((opt) => checkedKeys.value.includes(opt.key))
      .map((opt) => opt.label)
    const text = custom.value.trim()
    if (checkedKeys.value.includes(CUSTOM_KEY) && text) labels.push(text)
    return labels.join('、')
  }
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
  if (props.multiple) {
    if (!checkedKeys.value.includes(CUSTOM_KEY)) {
      checkedKeys.value = [...checkedKeys.value, CUSTOM_KEY]
    }
    return
  }
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

  // Fluent RadioButtons / Checkboxes：整行可点、hover/选中态背景
  :deep(.t-radio),
  :deep(.t-checkbox) {
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

    .t-radio__input,
    .t-checkbox__input {
      flex-shrink: 0;
      margin-top: 3px;
    }

    .t-radio__label,
    .t-checkbox__label {
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
