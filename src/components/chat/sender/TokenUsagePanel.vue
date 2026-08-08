<template>
  <div class="token-usage-panel">
    <div class="token-usage-panel__header">
      <span class="token-usage-panel__percent">{{ usedPercentLabel }}%</span>
      <span class="token-usage-panel__used">
        已使用 {{ formatTokens(contextTokens) }}/{{ formatTokens(contextWindow) }}
      </span>
    </div>
    <div class="token-usage-panel__bar">
      <div
        v-for="item in segments"
        :key="item.label"
        class="token-usage-panel__bar-segment"
        :style="{ width: `${item.width}%`, background: item.color }"
      />
    </div>
    <div class="token-usage-panel__list">
      <div v-for="item in segments" :key="item.label" class="token-usage-panel__row">
        <span class="token-usage-panel__dot" :style="{ background: item.color }" />
        <span class="token-usage-panel__label">{{ item.label }}</span>
        <span class="token-usage-panel__value">{{ item.percentLabel }}%</span>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import type { TokenBreakdown } from '@/domain'
import { formatTokens } from '@/utils/tokenEstimate'

const props = defineProps<{
  contextTokens: number
  contextWindow: number
  breakdown: TokenBreakdown
}>()

interface Segment {
  label: string
  value: number
  width: number
  percentLabel: string
  color: string
}

// 分类颜色与明细圆点一致：系统提示词 / 工具及子智能体 / 对话消息 / 技能
const CATEGORY_COLORS = [
  'var(--td-brand-color)',
  'var(--td-warning-color)',
  'var(--td-success-color)',
  'var(--td-error-color)'
]

const CATEGORY_LABELS: Array<keyof TokenBreakdown> = ['system', 'tools', 'conversation', 'skills']
const CATEGORY_NAMES: Record<keyof TokenBreakdown, string> = {
  system: '系统提示词',
  tools: '工具及子智能体',
  conversation: '对话消息',
  skills: '技能'
}

/** 已使用百分比（四舍五入整数） */
const usedPercent = computed(() => {
  if (props.contextWindow <= 0) return 0
  return Math.round((props.contextTokens / props.contextWindow) * 100)
})

const usedPercentLabel = computed(() => Math.min(usedPercent.value, 100))

/** 各分类按占上下文窗口的百分比渲染分段条（合计即已使用比例） */
const segments = computed<Segment[]>(() => {
  const { contextWindow, breakdown } = props
  if (contextWindow <= 0) return []
  return CATEGORY_LABELS.map((key, index) => {
    const value = breakdown[key]
    const rawPercent = (value / contextWindow) * 100
    return {
      label: CATEGORY_NAMES[key],
      value,
      width: Math.min(rawPercent, 100),
      percentLabel: rawPercent.toFixed(1).replace(/\.0$/, ''),
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length]
    }
  })
})
</script>
<style scoped lang="less">
.token-usage-panel {
  display: flex;
  width: 260px;
  flex-direction: column;
  gap: var(--td-comp-margin-s);
  padding: var(--td-comp-paddingTB-s) var(--td-comp-paddingLR-s);

  &__header {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  &__percent {
    color: var(--td-text-color-primary);
    font: var(--td-font-title-medium);
  }

  &__used {
    color: var(--td-text-color-placeholder);
    font: var(--td-font-body-small);
    font-variant-numeric: tabular-nums;
  }

  &__bar {
    display: flex;
    height: 6px;
    overflow: hidden;
    border-radius: 3px;
    background: var(--td-bg-color-component);

    &-segment {
      height: 100%;
    }
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: var(--td-comp-margin-xxs);
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__dot {
    width: 8px;
    height: 8px;
    flex-shrink: 0;
    border-radius: 50%;
  }

  &__label {
    flex: 1;
    overflow: hidden;
    color: var(--td-text-color-primary);
    font: var(--td-font-body-medium);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__value {
    color: var(--td-text-color-secondary);
    font: var(--td-font-body-small);
    font-variant-numeric: tabular-nums;
  }
}
</style>
