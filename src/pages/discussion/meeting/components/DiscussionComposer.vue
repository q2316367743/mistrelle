<template>
  <div class="discussion-composer">
    <div class="discussion-composer__title">发起结构化讨论</div>
    <div class="discussion-composer__desc">输入一个引子，角色们会围绕它依次展开观点。</div>
    <t-textarea
      :value="modelValue"
      :autosize="{ minRows: 2, maxRows: 5 }"
      placeholder="抛出一个问题或观点，AI们会围绕它展开讨论"
      @update:value="emit('update:modelValue', $event)"
      @enter="emit('start')"
    />
    <div class="discussion-composer__bar">
      <t-button variant="text" size="small" @click="emit('advanced')">
        <template #icon><setting-icon /></template>
        高级
      </t-button>
      <t-button theme="primary" :disabled="!canStart" @click="emit('start')">
        <template #icon><play-icon /></template>
        发起讨论
      </t-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PlayIcon, SettingIcon } from 'tdesign-icons-vue-next'

defineProps<{
  modelValue: string
  canStart: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  start: []
  advanced: []
}>()
</script>

<style scoped lang="less">
.discussion-composer {
  width: 100%;
  max-width: 720px;
  padding: var(--td-comp-paddingTB-l) var(--td-comp-paddingLR-xl);
  border: 1px solid var(--fluent-card-border);
  border-radius: var(--fluent-radius-card);
  background: var(--fluent-card-bg);
  box-shadow: var(--fluent-card-shadow);
}

.discussion-composer__title {
  color: var(--td-text-color-primary);
  font: var(--td-font-title-medium);
}

.discussion-composer__desc {
  margin: var(--td-comp-margin-xs) 0 var(--td-comp-margin-m);
  color: var(--td-text-color-secondary);
  font: var(--td-font-body-small);
}

.discussion-composer__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: var(--td-comp-margin-s);
}
</style>
