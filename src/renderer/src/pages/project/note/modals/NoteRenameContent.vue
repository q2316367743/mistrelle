<template>
  <div class="note-rename-content">
    <t-input
      v-model="name"
      class="mt-8px"
      placeholder="请输入新名称"
      clearable
      autofocus
      @enter="handleSubmit"
    />
    <div class="note-rename-content__actions">
      <t-button variant="outline" @click="emit('close')">取消</t-button>
      <t-button theme="primary" @click="handleSubmit">确定</t-button>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { validateNoteName } from '@/modules/note'
import { MessageUtil } from '@/utils/modal'

const props = defineProps<{
  /** 当前笔记名 */
  currentName: string
  /** 其他已占用笔记名（不含自身） */
  takenNames: string[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success', newName: string): void
}>()

const name = ref(props.currentName)

/** 仅做名称校验与收集，实际重命名由页面统一处理（需先落盘未保存内容） */
const handleSubmit = () => {
  const err = validateNoteName(name.value, props.takenNames)
  if (err) {
    MessageUtil.error(err)
    return
  }
  const target = name.value.trim()
  if (target === props.currentName) {
    emit('close')
    return
  }
  emit('success', target)
}
</script>
<style scoped lang="less">
.note-rename-content {
  &__actions {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}
</style>
