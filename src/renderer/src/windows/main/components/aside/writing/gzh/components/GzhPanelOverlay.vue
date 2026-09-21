<template>
  <div class="panel-overlay">
    <div class="panel-overlay__header">
      <span class="panel-overlay__title ellipsis" :title="title">{{ title }}</span>
      <t-button theme="default" variant="text" shape="square" size="small" @click="emit('close')">
        <template #icon><close-icon /></template>
      </t-button>
    </div>
    <div class="panel-overlay__body">
      <slot />
    </div>
  </div>
</template>
<script lang="ts" setup>
import { CloseIcon } from 'tdesign-icons-vue-next'

defineProps<{
  /** 浮层标题（当前能力面板名） */
  title: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()
</script>
<style scoped lang="less">
.panel-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 8px;
  background: var(--td-bg-color-container);

  &__header {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--td-border-level-1-color);
  }

  &__title {
    flex: 1;
    min-width: 0;
    font: var(--td-font-body-medium);
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  &__body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding-top: 8px;
  }
}
</style>
