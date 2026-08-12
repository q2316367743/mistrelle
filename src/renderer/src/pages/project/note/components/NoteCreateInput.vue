<template>
  <t-input
    v-model="draft"
    class="note-create-input"
    :autofocus="true"
    size="small"
    placeholder="输入名称，回车确认"
    @enter="confirm"
    @blur="cancel"
    @keydown="handleKeydown"
  />
</template>
<script lang="ts" setup>
const emit = defineEmits<{
  (e: 'confirm', name: string): void
  (e: 'cancel'): void
}>()

const draft = ref('')

const confirm = () => {
  emit('confirm', draft.value.trim())
}

const cancel = () => {
  emit('cancel')
}

const handleKeydown = (_value: string | number, context: { e: KeyboardEvent }) => {
  if (context.e.key === 'Escape') emit('cancel')
}
</script>
<style scoped lang="less">
.note-create-input {
  width: 160px;
}
</style>
