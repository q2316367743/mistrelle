<template>
  <div class="bg-setting-row">
    <div class="bg-setting__meta">
      <div class="bg-setting__title">{{ title }}</div>
      <div class="bg-setting__desc">{{ description }}</div>
    </div>
    <div class="bg-setting__action">
      <t-radio-group
        :model-value="type"
        theme="button"
        variant="primary-filled"
        size="small"
        @change="(val) => handleTypeChange(val as BackgroundType)"
      >
        <t-radio-button value="solid">纯色</t-radio-button>
        <t-radio-button value="gradient">渐变</t-radio-button>
        <t-radio-button value="image">图片</t-radio-button>
        <t-radio-button value="video">视频</t-radio-button>
      </t-radio-group>
      <div class="bg-setting__value">
        <template v-if="type === 'solid' || type === 'gradient'">
          <t-color-picker
            :model-value="value"
            class="bg-setting__picker"
            format="CSS"
            :color-modes="colorModes"
            clearable
            @change="handleColorChange"
          />
        </template>
        <template v-else>
          <div class="bg-setting__media-row">
            <div class="bg-setting__file-row">
              <t-input
                :model-value="value"
                class="bg-setting__input"
                :placeholder="placeholder"
                size="small"
                clearable
                readonly
                @clear="handleClear"
              />
              <t-button variant="outline" size="small" @click="handlePickFile">选择</t-button>
              <t-button v-if="value" variant="text" size="small" @click="handleClear">清空</t-button>
            </div>
            <div class="bg-setting__opacity-row">
              <span class="bg-setting__opacity-label">透明度</span>
              <t-slider v-model="opacityValue" :min="0" :max="1" :step="0.01" class="bg-setting__slider" />
              <span class="bg-setting__opacity-value">{{ Math.round(opacityValue * 100) }}%</span>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { BackgroundType, BackgroundValue } from '@/entity'

const props = defineProps<{
  title: string
  description: string
  modelValue: BackgroundValue
  transparent: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: BackgroundValue]
}>()

const type = computed<BackgroundType>(() => props.modelValue.type)
const value = computed<string>(() => props.modelValue.value)

const opacityValue = computed({
  get: () => props.modelValue.opacity ?? 1,
  set: (val) => emit('update:modelValue', { ...props.modelValue, opacity: val })
})

const colorModes = computed<Array<'monochrome' | 'linear-gradient'>>(() => {
  return type.value === 'solid' ? ['monochrome'] : ['linear-gradient']
})

const placeholder = computed(() => {
  return type.value === 'image' ? '请选择本地图片文件' : '请选择本地视频文件'
})

/**
 * 切换类型时重置为对应默认值，避免旧值与新类型不匹配
 */
const handleTypeChange = (val: BackgroundType) => {
  const defaultValue =
    val === 'solid'
      ? props.transparent
      : val === 'gradient'
        ? 'linear-gradient(90deg, rgb(255, 255, 255) 0%, rgb(0, 0, 0) 100%)'
        : ''
  const isImageVideo = val === 'image' || val === 'video'
  emit('update:modelValue', { type: val, value: defaultValue, opacity: isImageVideo ? 0.3 : 1 })
}

const handleColorChange = (val: string) => {
  emit('update:modelValue', { ...props.modelValue, value: val })
}

const handleClear = () => {
  emit('update:modelValue', { ...props.modelValue, value: '' })
}

const filters = computed(() => {
  if (type.value === 'image') {
    return [{ name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'] }]
  }
  if (type.value === 'video') {
    return [{ name: '视频文件', extensions: ['mp4', 'webm', 'mov', 'mkv', 'avi'] }]
  }
  return []
})

/**
 * 调用原生文件选择对话框，获取本地图片/视频路径
 */
const handlePickFile = () => {
  const res = window.preload.inject.dialog.open({
    title: `选择 ${props.title} 文件`,
    properties: ['openFile'],
    filters: filters.value,
    defaultPath: value.value || undefined
  })
  if (res && res.length > 0) {
    emit('update:modelValue', { ...props.modelValue, value: res[0] })
  }
}
</script>

<style scoped lang="less">
.bg-setting-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px 0;
  border-top: 1px solid var(--td-component-stroke);

  &:first-child {
    border-top: none;
  }
}

.bg-setting__meta {
  flex: 1;
  min-width: 0;
}

.bg-setting__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.bg-setting__desc {
  margin-top: 4px;
  font-size: 12px;
  line-height: 18px;
  color: var(--td-text-color-secondary);
}

.bg-setting__action {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  width: 420px;
  flex-shrink: 0;
}

.bg-setting__value {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.bg-setting__picker {
  flex: 1;
}

.bg-setting__input {
  flex: 1;
}

.bg-setting__media-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.bg-setting__file-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bg-setting__opacity-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bg-setting__slider {
  flex: 1;
}

.bg-setting__opacity-label {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  white-space: nowrap;
}

.bg-setting__opacity-value {
  font-size: 12px;
  color: var(--td-text-color-primary);
  min-width: 36px;
  text-align: right;
}
</style>
