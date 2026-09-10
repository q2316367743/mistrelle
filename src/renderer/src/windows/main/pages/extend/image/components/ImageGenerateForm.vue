<template>
  <div class="generate-form">
    <t-textarea
      v-model="prompt"
      class="prompt-area"
      placeholder="描述你想生成的画面，建议使用详细英文描述（主体 / 风格 / 配色 / 构图）…"
      :autosize="{ minRows: 3, maxRows: 6 }"
      @keydown.ctrl.enter.prevent="handleSubmit"
      @keydown.meta.enter.prevent="handleSubmit"
    />
    <div class="params-row">
      <t-select
        v-model="modelKey"
        class="model-select"
        :loading="imageModelStore.loading"
        clearable
        placeholder="生图模型"
      >
        <t-option
          v-for="item in imageModelStore.items"
          :key="item.value"
          :value="item.value"
          :label="item.label"
        >
          <div class="model-option">
            <span class="model-option-name">{{ modelName(item) }}</span>
            <span v-if="item.pointsPerImage != null" class="model-option-points">
              {{ item.pointsPerImage }} 积分/张
            </span>
          </div>
        </t-option>
      </t-select>
      <style-select v-model="styleId" class="style-select" />
      <t-select
        v-model="size"
        class="size-select"
        :options="SIZE_OPTIONS"
        filterable
        creatable
        placeholder="尺寸"
      />
      <t-select
        v-model="resolution"
        class="resolution-select"
        :options="RESOLUTION_OPTIONS"
        placeholder="分辨率"
      />
      <t-select v-model="n" class="n-select" :options="N_OPTIONS" placeholder="张数" />
    </div>
    <div class="form-actions">
      <div class="action-left">
        <image-reference-picker v-model="imagePaths" />
        <t-button variant="text" size="small" @click="showAdvanced = !showAdvanced">
          高级参数
          <template #icon>
            <ChevronDownIcon class="chevron" :class="{ open: showAdvanced }" />
          </template>
        </t-button>
        <span v-if="modelTip" class="model-tip">
          <span class="tip-text">{{ modelTip }}</span>
          <t-button
            v-if="imageModelStore.needLogin"
            variant="text"
            size="small"
            theme="primary"
            @click="openLogin()"
          >
            登录
          </t-button>
        </span>
      </div>
      <t-button theme="primary" :disabled="!canSubmit" @click="handleSubmit">
        <template #icon><AiImageIcon /></template>
        生成图片
      </t-button>
    </div>
    <image-advanced-options v-if="showAdvanced" v-model="advanced" class="advanced-panel" />
    <t-alert v-if="sizeError" theme="warning" class="size-error">{{ sizeError }}</t-alert>
  </div>
</template>

<script lang="ts" setup>
import { useImageModelStore, useSettingDefaultStore } from '@/windows/main/store'
import { openLogin } from '@/components/modals/LoginDialog'
import { AiImageIcon, ChevronDownIcon } from 'tdesign-icons-vue-next'
import ImageAdvancedOptions from './ImageAdvancedOptions.vue'
import ImageReferencePicker from './ImageReferencePicker.vue'
import type { ImageAdvancedState, ImageFormSubmit } from '../image-page-utils'

/** 「自动」哨兵值：提交时不传该参数，由服务端 / 上游决定 */
const AUTO = 'auto'

/** 尺寸选项：自动 + 常用比例（配合分辨率档位）+ 常用像素；可手动输入比例或宽x高 */
const SIZE_OPTIONS = [
  { label: '自动（跟随模型 / 参考图）', value: AUTO },
  { label: '1:1 方形', value: '1:1' },
  { label: '16:9 横版', value: '16:9' },
  { label: '9:16 竖版', value: '9:16' },
  { label: '4:3 横版', value: '4:3' },
  { label: '3:4 竖版', value: '3:4' },
  { label: '3:2 横版', value: '3:2' },
  { label: '2:3 竖版', value: '2:3' },
  { label: '方形 1024×1024', value: '1024x1024' },
  { label: '竖版 1024×1536', value: '1024x1536' },
  { label: '横版 1536×1024', value: '1536x1024' }
]
/** 像素档位（与 size 共同决定实际输出尺寸） */
const RESOLUTION_OPTIONS = [
  { label: '自动', value: AUTO },
  { label: '1K', value: '1k' },
  { label: '2K', value: '2k' },
  { label: '4K', value: '4k' }
]
/** 单次生成张数（1-4） */
const N_OPTIONS = [1, 2, 3, 4].map((value) => ({ label: `${value} 张`, value }))

const emit = defineEmits<{ submit: [form: ImageFormSubmit] }>()

const imageModelStore = useImageModelStore()
const settingDefaultStore = useSettingDefaultStore()

const prompt = ref('')
/** 选中的服务端生图档位 code（选项 value） */
const modelKey = ref('')
/** 选中的设计风格 id；空 = 不注入风格提示词 */
const styleId = ref('')
const size = ref(AUTO)
const resolution = ref(AUTO)
const n = ref(1)
const imagePaths = ref<string[]>([])
/** 高级参数（未设置的键提交时原样为空，main 侧不透传） */
const advanced = ref<ImageAdvancedState>({})
const showAdvanced = ref(false)
const sizeError = ref('')

/** 下拉展示用档位名（去掉 label 里的积分后缀） */
function modelName(item: ImageModelOption): string {
  if (item.pointsPerImage == null) return item.label
  const suffix = `（${item.pointsPerImage}积分）`
  return item.label.endsWith(suffix) ? item.label.slice(0, -suffix.length) : item.label
}

// 默认选中：优先「默认生图模型」，否则列表首项（仅表单内选中，不写回设置）。
// 只监听列表与默认值变化：用户手动改选 / 清空后不被自动覆盖
watch(
  () => [imageModelStore.items, settingDefaultStore.state.defaultImageModel] as const,
  () => {
    if (modelKey.value) return
    const items = imageModelStore.items
    if (!items.length) return
    const preferred = settingDefaultStore.state.defaultImageModel
    modelKey.value = items.some((option) => option.value === preferred)
      ? preferred
      : (items[0]?.value ?? '')
  },
  { immediate: true, deep: true }
)

const canSubmit = computed(
  () =>
    prompt.value.trim().length > 0 &&
    !sizeError.value &&
    !!modelKey.value &&
    !imageModelStore.needLogin
)
/** 模型引导提示：未登录 → 登录引导；已登录无模型 / 未选中 → 对应提示 */
const modelTip = computed(() => {
  if (imageModelStore.needLogin) return '登录后可使用生图'
  if (!imageModelStore.items.length) {
    return imageModelStore.loading ? '正在获取生图模型…' : '暂无可用生图模型'
  }
  if (!modelKey.value) return '请选择生图模型'
  return ''
})

const validateSize = () => {
  const value = size.value === AUTO ? '' : size.value.trim()
  sizeError.value =
    value && !/^\d{3,4}[xX]\d{3,4}$|^\d{1,2}:\d{1,2}$/.test(value)
      ? '尺寸支持 宽x高（如 1024x1024）或 比例（如 16:9）'
      : ''
}

watch(size, validateSize)

const handleSubmit = () => {
  validateSize()
  if (!canSubmit.value) return
  emit('submit', {
    prompt: prompt.value.trim(),
    size: size.value === AUTO ? undefined : (size.value.trim() || undefined),
    model: modelKey.value?.trim() || undefined,
    styleId: styleId.value?.trim() || undefined,
    n: n.value > 1 ? n.value : undefined,
    resolution: resolution.value === AUTO ? undefined : resolution.value,
    ...advanced.value,
    imageUrls: imagePaths.value.length ? [...imagePaths.value] : undefined
  })
  // 任务已提交（失败可从记录卡「重试」找回 prompt），清空输入框供连续生成
  prompt.value = ''
}
</script>

<style scoped lang="less">
.generate-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.params-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.form-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.action-left {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.model-select {
  width: 160px;
}

.style-select {
  width: 200px;
}

.size-select {
  width: 160px;
}

.resolution-select {
  width: 96px;
}

.n-select {
  width: 84px;
}

.model-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.model-option-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-option-points {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--td-text-color-placeholder);
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

.chevron {
  transition: transform 0.2s ease;

  &.open {
    transform: rotate(180deg);
  }
}

.advanced-panel {
  margin: 0;
}

.size-error {
  margin: 0;
}
</style>
