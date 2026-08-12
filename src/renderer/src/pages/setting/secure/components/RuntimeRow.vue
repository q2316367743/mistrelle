<template>
  <div class="runtime-row">
    <t-icon :name="icon" class="runtime-icon" />
    <div class="runtime-meta">
      <div class="runtime-name">{{ name }}</div>
      <div class="runtime-desc">{{ description }}</div>
    </div>
    <div class="flex items-center gap-8px">
      <t-input
        :model-value="modelValue"
        class="w-360px"
        :placeholder="placeholder"
        allow-clear
        @update:model-value="(v: string) => emit('update:modelValue', v)"
      />
      <t-button variant="outline" @click="pickPath">选择</t-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
const props = defineProps<{
  icon: string
  name: string
  description: string
  modelValue: string
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

/**
 * 调用原生文件选择对话框，将选中的可执行文件路径写回对应运行时字段
 */
const pickPath = () => {
  const res = window.preload.inject.dialog.open({
    title: `选择 ${props.name} 可执行文件`,
    properties: ['openFile'],
    defaultPath: props.modelValue || undefined
  })
  if (res && res.length > 0) {
    emit('update:modelValue', res[0])
  }
}
</script>

<style scoped lang="less">
.runtime-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--td-component-stroke);

  &:first-child {
    padding-top: 4px;
    border-top: none;
  }
}

.runtime-icon {
  flex: none;
  font-size: 20px;
  color: var(--td-text-color-secondary);
}

.runtime-meta {
  flex: 1;
  min-width: 0;
}

.runtime-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.runtime-desc {
  margin-top: 2px;
  font-size: 12px;
  line-height: 18px;
  color: var(--td-text-color-secondary);
}
</style>
