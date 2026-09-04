<template>
  <div class="design-project-put-content">
    <t-form label-align="top">
      <t-form-item label="设计名称">
        <t-input
          v-model="name"
          placeholder="如：夏日促销海报系列"
          maxlength="30"
          @enter="handleSubmit"
        />
      </t-form-item>
    </t-form>
    <div class="flex justify-end gap-8px mt-8px mb-[-9px]">
      <t-button theme="default" @click="emit('close')">取消</t-button>
      <t-button theme="primary" :disabled="!canSubmit" @click="handleSubmit">确定</t-button>
    </div>
  </div>
</template>
<script lang="ts" setup>
const props = defineProps<{ initialName?: string }>()

const emit = defineEmits<{
  (e: 'success', name: string): void
  (e: 'close'): void
}>()

const name = ref(props.initialName ?? '')
const canSubmit = computed(() => name.value.trim().length > 0)

const handleSubmit = () => {
  if (!canSubmit.value) return
  emit('success', name.value.trim())
}
</script>
