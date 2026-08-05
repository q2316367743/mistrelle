<template>
  <t-popup v-model:visible="visible" placement="top" trigger="click">
    <div class="ai-model-select" :title="select">
      <div class="ai-select-label ellipsis">{{ select }}</div>
      <chevron-down-icon :style="chevronIconStyle" />
    </div>
    <template #content>
      <div class="ai-select-options">
        <div v-for="provide in items" :key="provide.group" class="ai-provide">
          <div class="provide-name">{{ provide.group }}</div>
          <div
            v-for="model in provide.children"
            :key="`${model.value}`"
            :class="['provide-model', { active: modelValue === model.value }]"
            @click="handleSelect(`${model.value}`)"
          >
            <div>{{ model.label }}</div>
          </div>
        </div>
      </div>
      <div class="ai-thinking-setting">
        <div class="ai-thinking-row">
          <span class="ai-thinking-label">思考模式</span>
          <t-switch v-model="thinking" size="small" />
        </div>
        <div v-if="thinking" class="ai-thinking-row">
          <span class="ai-thinking-label">思考强度</span>
          <t-radio-group v-model="effort" theme="button" size="small" :options="effortOptions" />
        </div>
      </div>
      <div class="ai-provide-setting flex mb-4px" @click="handleModelSetting()">
        <setting1-icon />
        <span class="ml-8px">模型设置</span>
        <chevron-right-icon class="ml-auto" />
      </div>
    </template>
  </t-popup>
</template>
<script lang="ts" setup>
import { useSettingAiStore } from '@/store'
import type { ThinkingEffort } from '@/domain'
import { ChevronDownIcon, ChevronRightIcon, SearchIcon, Setting1Icon } from 'tdesign-icons-vue-next'

const modelValue = defineModel({
  type: String,
  default: ''
})

// 是否启用思考模式
const thinking = defineModel<boolean>('thinking', { default: true })
// 思考强度
const effort = defineModel<ThinkingEffort>('effort', { default: 'high' })

const effortOptions = [
  { label: '低', value: 'low' },
  { label: '高', value: 'high' },
  { label: '最高', value: 'max' }
]

const router = useRouter()

const visible = ref(false)

const items = computed(() => useSettingAiStore().options)
const select = computed(() => {
  if (!modelValue.value) return '请选择模型'
  return modelValue.value.split(':').pop() || '请选择模型'
})
const chevronIconStyle = computed(() => ({
  transform: visible.value ? 'rotate(180deg)' : '',
  transition: 'all 200ms ease-in-out',
  marginLeft: '8px'
}))

const handleSelect = (val: string) => {
  modelValue.value = val
  visible.value = false
}
const handleModelSetting = () => router.push('/setting/ai')
</script>
<style scoped lang="less">
.ai-model-select {
  display: flex;
  align-items: center;
  cursor: pointer;
  height: 32px;
}
.ai-select-label {
  max-width: 120px;
  overflow: hidden;
  text-align: right;
  user-select: none;
}

.ai-select-options {
  height: 240px;
  margin: 8px 0;
  overflow: auto;
  padding: var(--td-pop-padding-m);

  .ai-provide {
    border-bottom: 1px solid var(--td-border-level-1-color);
    &:last-child {
      border: none;
    }
    .provide-name {
      color: var(--td-text-color-placeholder);
      display: block;
      height: var(--td-comp-size-s);
      line-height: var(--td-comp-size-s);
      padding: 0 var(--td-comp-paddingLR-s);
      box-sizing: border-box;
      white-space: nowrap;
      word-wrap: normal;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
  .provide-model {
    display: flex;
    align-items: center;
    border-radius: var(--td-radius-default);
    height: var(--td-comp-size-s);
    font: var(--td-font-body-medium);
    cursor: pointer;
    padding: 0 var(--td-comp-paddingLR-s);
    color: var(--td-text-color-primary);
    transition: background-color 0.2s cubic-bezier(0.38, 0, 0.24, 1);
    box-sizing: border-box;
    --ripple-color: var(--td-bg-color-container-active);
    font: var(--td-font-body-medium);
    margin-top: var(--td-comp-paddingTB-xxs);

    &:hover {
      background-color: var(--td-bg-color-container-hover);
    }
    &:active {
      background-color: var(--td-brand-color-light-hover);
    }
    &.active {
      background-color: var(--td-brand-color-light-hover);
      color: var(--td-brand-color);
      font-weight: bold;
    }
  }
  border-bottom: 1px solid var(--td-border-level-1-color);
}
.ai-thinking-setting {
  padding: 4px 4px 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-bottom: 1px solid var(--td-border-level-1-color);
  margin-bottom: 4px;

  .ai-thinking-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .ai-thinking-label {
    font: var(--td-font-body-medium);
    color: var(--td-text-color-primary);
  }
}
.ai-provide-setting {
  padding: 4px;
  align-items: center;
  align-content: center;
  border-radius: var(--td-radius-medium);
  &:hover {
    background-color: var(--td-bg-color-component-hover);
    cursor: pointer;
    transition: background-color 0.3s ease-in-out;
  }
}
</style>
