<template>
  <div class="generate-form">
    <t-textarea
      v-model="prompt"
      class="prompt-area"
      placeholder="描述你想生成的画面，建议使用详细英文描述（主体 / 风格 / 配色 / 构图）…"
      :autosize="{ minRows: 3, maxRows: 6 }"
      :maxlength="2000"
      @keydown.ctrl.enter.prevent="handleSubmit"
      @keydown.meta.enter.prevent="handleSubmit"
    />
    <div class="form-actions">
      <div class="action-left">
        <t-select
          v-model="modelKey"
          class="model-select"
          :options="imageOptions"
          clearable
          placeholder="生图模型"
        >
        </t-select>
        <style-select v-model="styleId" class="style-select" />
        <t-select
          v-model="size"
          class="size-select"
          :options="SIZE_OPTIONS"
          filterable
          creatable
          placeholder="尺寸"
        >
        </t-select>
        <span v-if="modelTip" class="model-tip">
          <span class="tip-text">{{ modelTip }}</span>
          <t-button v-if="!hasAnyImageModel" variant="text" size="small" theme="primary" @click="goSetting">
            去设置
          </t-button>
        </span>
      </div>
      <t-button
        theme="primary"
        size="large"
        :disabled="!canSubmit"
        @click="handleSubmit"
      >
        <template #icon><AiIcon /></template>
        生成图片
      </t-button>
    </div>
    <t-alert v-if="sizeError" theme="warning" class="size-error">{{ sizeError }}</t-alert>
  </div>
</template>

<script lang="ts" setup>
import { useRouter } from 'vue-router'
import { useSettingAiStore, useSettingDefaultStore } from '@/store'
import { AiIcon } from 'tdesign-icons-vue-next'
import type { SelectOptionGroup } from 'tdesign-vue-next'

/** 常用尺寸（部分中转站强制要求，全模型安全值默认 1024x1024） */
const SIZE_OPTIONS = [
  { label: '方形 1024×1024', value: '1024x1024' },
  { label: '竖版 1024×1536', value: '1024x1536' },
  { label: '横版 1536×1024', value: '1536x1024' }
]

const emit = defineEmits<{
  submit: [prompt: string, size?: string, model?: string, styleId?: string]
}>()

const router = useRouter()
const aiStore = useSettingAiStore()
const settingDefaultStore = useSettingDefaultStore()

/** 可用的生图模型（type=image 分组下拉，value = `${provideId}:${identifier}`） */
const imageOptions = computed<SelectOptionGroup[]>(() =>
  aiStore.ready ? aiStore.imageOptions : []
)
const hasAnyImageModel = computed(() => imageOptions.value.some((g) => g.children?.length))
const hasDefaultImageModel = computed(() => !!settingDefaultStore.state.defaultImageModel)

const prompt = ref('')
/** 显式选择的模型 key；空 = 跟随默认生图模型 */
const modelKey = ref('')
/** 选中的设计风格 id；空 = 不注入风格提示词 */
const styleId = ref('')
const size = ref('1024x1024')
const sizeError = ref('')

// 有默认生图模型时自动选中（store 异步读盘后回填；用户手动改选后不覆盖）
watch(
  () => settingDefaultStore.state.defaultImageModel,
  (val) => {
    if (val && !modelKey.value) modelKey.value = val
  },
  { immediate: true }
)

const hasModelReady = computed(() => !!modelKey.value || hasDefaultImageModel.value)
const canSubmit = computed(
  () => prompt.value.trim().length > 0 && !sizeError.value && hasModelReady.value
)
/** 模型引导提示：无可用模型 → 去设置；有模型但未选且无默认 → 提示选择 */
const modelTip = computed(() => {
  if (!hasAnyImageModel.value) return '未配置生图模型'
  if (!hasModelReady.value) return '请选择生图模型'
  return ''
})

const validateSize = () => {
  const value = size.value?.trim() ?? ''
  sizeError.value = value && !/^\d{3,4}[xX]\d{3,4}$/.test(value) ? '尺寸格式应为 宽x高（如 1024x1024）' : ''
}

watch(size, validateSize)

const handleSubmit = () => {
  validateSize()
  if (!canSubmit.value) return
  emit(
    'submit',
    prompt.value.trim(),
    size.value?.trim() || undefined,
    modelKey.value?.trim() || undefined,
    styleId.value?.trim() || undefined
  )
  // 任务已提交（失败可从记录卡「重试」找回 prompt），清空输入框供连续生成
  prompt.value = ''
}

const goSetting = () => {
  router.push('/setting/default')
}
</script>

<style scoped lang="less">
.generate-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.action-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.model-select {
  width: 220px;
}

.style-select {
  width: 200px;
}

.size-select {
  width: 160px;
}

.model-tip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--td-text-color-placeholder);
}

.tip-text {
  font-size: 13px;
}

.size-error {
  margin: 0;
}
</style>