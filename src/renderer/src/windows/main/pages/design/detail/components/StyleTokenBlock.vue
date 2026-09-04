<template>
  <div class="token-block">
    <div v-for="row in rows" :key="row.label" class="token-block__row">
      <span class="token-block__label">{{ row.label }}</span>
      <span class="token-block__value">{{ row.value }}</span>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { AiDesignStyleTokens } from '@/entity'

const props = defineProps<{ tokens: AiDesignStyleTokens }>()

const rows = computed(() => {
  const t = props.tokens
  return [
    {
      label: '间距',
      value: `页面边距 ${t.spacing.pageMargin}px / 区块间距 ${t.spacing.sectionGap}px / 卡片内边距 ${t.spacing.cardPadding}px / 基准单位 ${t.spacing.baseUnit}px`
    },
    {
      label: '圆角',
      value: `小 ${t.radius.small}px / 中 ${t.radius.medium}px / 大 ${t.radius.large}px${t.radius.pill ? '，胶囊按钮' : ''}`
    },
    {
      label: '边框',
      value: t.border.style === 'none' ? '无边框' : `${t.border.width}px ${t.border.style} ${t.border.color}`
    },
    {
      label: '阴影',
      value: t.shadow.enabled
        ? `${t.shadow.offsetX}px ${t.shadow.offsetY}px ${t.shadow.blur}px ${t.shadow.color}`
        : '不启用'
    },
    {
      label: '动效',
      value: `${t.motion.duration}ms ${t.motion.easing} · ${t.motion.scope}`
    }
  ]
})
</script>

<style scoped lang="less">
.token-block {
  &__row {
    display: grid;
    grid-template-columns: 56px 1fr;
    gap: 12px;
    padding: 8px 0;
    font: var(--td-font-body-medium);
    color: var(--td-text-color-primary);
    border-bottom: 1px solid var(--td-component-stroke);

    &:last-child {
      border-bottom: none;
    }
  }

  &__label {
    color: var(--td-text-color-placeholder);
  }
}
</style>
