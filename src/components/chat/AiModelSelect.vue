<template>
  <t-popup v-model:visible="visible" placement="top" trigger="click">
    <div class="ai-model-select" :title="select">
      <div class="ai-select-label ellipsis">{{ select }}</div>
      <chevron-down-icon :style="chevronIconStyle" />
    </div>
    <template #content>
      <t-input v-model="keyword" clearable class="w-200px mt-4px">
        <template #prefix-icon>
          <search-icon />
        </template>
      </t-input>
      <div class="ai-select-options">
        <div v-for="provide in filteredItems" :key="provide.group" class="ai-provide">
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
import { ChevronDownIcon, ChevronRightIcon, SearchIcon, Setting1Icon } from 'tdesign-icons-vue-next'

const modelValue = defineModel({
  type: String,
  default: ''
})

const router = useRouter()

const visible = ref(false)

const keyword = ref('')

const items = computed(() => useSettingAiStore().options)
const filteredItems = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return items.value
  return items.value
    .map((group) => ({
      ...group,
      children: group.children.filter(
        (m) => m.label?.toLowerCase().includes(kw) || String(m.value).toLowerCase().includes(kw)
      )
    }))
    .filter((group) => group.children.length > 0)
})
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
