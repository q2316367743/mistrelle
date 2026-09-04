<template>
  <div class="typo-block">
    <div class="typo-block__row typo-block__row--head">
      <span>层级</span>
      <span>字体</span>
      <span>字重</span>
      <span>字号</span>
      <span>行高</span>
    </div>
    <div v-for="g in typoGroups" :key="g.key" class="typo-block__row">
      <span>{{ g.label }}</span>
      <span>{{ typography[g.key].font || '-' }}</span>
      <span>{{ typography[g.key].weight }}</span>
      <span>{{ typography[g.key].size }}px</span>
      <span>{{ typography[g.key].lineHeight }}</span>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { AiDesignStyleTypography } from '@/entity'

defineProps<{ typography: AiDesignStyleTypography }>()

const typoGroups = [
  { key: 'heading', label: '标题' },
  { key: 'body', label: '正文' },
  { key: 'caption', label: '辅助' }
] as const
</script>

<style scoped lang="less">
.typo-block {
  &__row {
    display: grid;
    grid-template-columns: 72px 1fr 64px 72px 64px;
    gap: 8px;
    padding: 8px 0;
    font: var(--td-font-body-medium);
    color: var(--td-text-color-primary);
    border-bottom: 1px solid var(--td-component-stroke);

    &:last-child {
      border-bottom: none;
    }

    &--head {
      font: var(--td-font-body-small);
      color: var(--td-text-color-placeholder);
    }
  }
}
</style>
