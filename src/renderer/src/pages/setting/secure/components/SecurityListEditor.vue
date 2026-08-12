<template>
  <div class="list-editor">
    <div class="editor-header">
      <t-icon :name="icon" class="editor-icon" />
      <div class="editor-meta">
        <div class="editor-title">{{ title }}</div>
        <div v-if="description" class="editor-desc">{{ description }}</div>
      </div>
    </div>
    <div class="editor-body">
      <div class="add-row">
        <t-input
          v-model="newItem"
          class="add-input"
          :placeholder="placeholder"
          @enter="addItem"
        />
        <t-button v-if="showPicker" variant="outline" @click="pickItems">
          选择
        </t-button>
        <t-button @click="addItem">
          <template #icon>
            <add-icon />
          </template>
          添加
        </t-button>
      </div>
      <div v-if="modelValue.length" class="item-list">
        <div
          v-for="(item, idx) in modelValue"
          :key="`${item}-${idx}`"
          class="item-row"
        >
          <t-icon :name="itemIcon" class="item-icon" />
          <span class="item-text">{{ item }}</span>
          <t-tag
            v-if="isDefault(item)"
            theme="success"
            variant="light"
            size="small"
          >
            内置
          </t-tag>
          <t-button
            v-else
            variant="text"
            shape="square"
            size="small"
            @click="removeItem(idx)"
          >
            <template #icon>
              <close-icon />
            </template>
          </t-button>
        </div>
      </div>
      <t-empty v-else description="暂无数据" class="empty-state" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { AddIcon, CloseIcon } from 'tdesign-icons-vue-next'

const props = withDefaults(
  defineProps<{
    icon: string
    title: string
    description?: string
    placeholder?: string
    itemIcon?: string
    modelValue: string[]
    defaultList?: string[]
    showPicker?: boolean
    pickerTitle?: string
    pickerProperties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>
  }>(),
  {
    itemIcon: 'folder',
    placeholder: '输入后按回车添加',
    defaultList: () => [],
    pickerTitle: '选择路径',
    pickerProperties: () => ['openFile', 'openDirectory', 'multiSelections']
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const newItem = ref('')

const addItem = () => {
  const value = newItem.value.trim()
  if (!value || props.modelValue.includes(value)) return
  emit('update:modelValue', [...props.modelValue, value])
  newItem.value = ''
}

const removeItem = (idx: number) => {
  const next = [...props.modelValue]
  next.splice(idx, 1)
  emit('update:modelValue', next)
}

const isDefault = (item: string) => props.defaultList.includes(item)

/**
 * 调用原生文件选择对话框，将选中结果追加到列表（自动去重）
 */
const pickItems = () => {
  const res = window.preload.inject.dialog.open({
    title: props.pickerTitle,
    properties: props.pickerProperties,
    defaultPath: props.modelValue[props.modelValue.length - 1] || undefined
  })
  if (res && res.length > 0) {
    const next = [...props.modelValue]
    res.forEach((item) => {
      if (!next.includes(item)) next.push(item)
    })
    emit('update:modelValue', next)
  }
}
</script>

<style scoped lang="less">
.list-editor {
  padding: 16px;
  background-color: var(--td-bg-color-container);
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-medium);
}

.editor-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.editor-icon {
  flex: none;
  margin-top: 2px;
  font-size: 20px;
  color: var(--td-brand-color);
}

.editor-meta {
  flex: 1;
  min-width: 0;
}

.editor-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.editor-desc {
  margin-top: 2px;
  font-size: 12px;
  line-height: 18px;
  color: var(--td-text-color-secondary);
}

.add-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.add-input {
  flex: 1;
}

.item-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background-color: var(--td-bg-color-secondarycontainer);
  border-radius: var(--td-radius-default);
}

.item-icon {
  flex: none;
  font-size: 18px;
  color: var(--td-text-color-secondary);
}

.item-text {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--td-text-color-primary);
  word-break: break-all;
}

.empty-state {
  margin-top: 16px;
}
</style>
