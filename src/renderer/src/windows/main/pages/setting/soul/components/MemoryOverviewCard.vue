<template>
  <section class="overview">
    <div class="overview__hero">
      <div class="overview__icon">
        <t-icon name="bookmark" />
      </div>
      <div class="overview__meta">
        <div class="overview__title-row">
          <h2 class="overview__title">记忆系统</h2>
          <t-tag :theme="enabled ? 'success' : 'default'" variant="light" size="small">
            {{ enabled ? '已启用' : '已停用' }}
          </t-tag>
        </div>
        <p class="overview__desc">
          对话空闲后自动提取短期记忆，每日整理进长期记忆，并在新对话中作为背景注入
        </p>
      </div>
      <t-switch
        class="overview__switch"
        :value="enabled"
        @change="(value: SwitchValue) => emit('update:enabled', Boolean(value))"
      />
    </div>

    <div class="overview__metrics">
      <div class="metric">
        <span class="metric__label">长期记忆</span>
        <span class="metric__value" :class="{ 'is-over': longTermChars > longTermMax }">
          {{ longTermChars }}
          <span class="metric__hint"> / {{ longTermMax }} 字</span>
        </span>
      </div>
      <div class="metric">
        <span class="metric__label">短期记忆</span>
        <span class="metric__value">
          {{ dayCount }}
          <span class="metric__hint"> 天</span>
        </span>
      </div>
      <div class="metric">
        <span class="metric__label">上次整理</span>
        <span class="metric__value metric__value--sm">{{ lastConsolidatedLabel }}</span>
      </div>
    </div>
  </section>
</template>
<script lang="ts" setup>
import type { SwitchValue } from 'tdesign-vue-next'

defineProps<{
  enabled: boolean
  longTermChars: number
  longTermMax: number
  dayCount: number
  /** 上次整理时间的展示文案，未整理过时为占位文案 */
  lastConsolidatedLabel: string
}>()

const emit = defineEmits<{
  'update:enabled': [boolean]
}>()
</script>
<style scoped lang="less">
.overview {
  background: var(--fluent-card-bg);
  border: 1px solid var(--fluent-card-border);
  border-radius: var(--fluent-radius-card);
  box-shadow: var(--fluent-elevation-1);
  overflow: hidden;
}

.overview__hero {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
}

.overview__icon {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--fluent-radius-smooth);
  background: var(--fluent-gradient-primary);
  color: var(--td-text-color-anti);
  font-size: 24px;
}

.overview__meta {
  flex: 1;
  min-width: 0;
}

.overview__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.overview__title {
  margin: 0;
  font: var(--td-font-title-large);
  color: var(--td-text-color-primary);
}

.overview__desc {
  margin: 4px 0 0;
  font: var(--td-font-body-medium);
  color: var(--td-text-color-secondary);
}

.overview__switch {
  flex: none;
}

.overview__metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-top: 1px solid var(--td-component-stroke);
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 20px 16px;

  & + & {
    border-left: 1px solid var(--td-component-stroke);
  }

  &__label {
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
  }

  &__value {
    font: var(--td-font-title-medium);
    color: var(--td-text-color-primary);

    &--sm {
      font: var(--td-font-body-large);
      font-weight: 600;
    }

    &.is-over {
      color: var(--td-error-color);
    }
  }

  &__hint {
    font: var(--td-font-body-small);
    font-weight: 400;
    color: var(--td-text-color-placeholder);
  }
}

@media (max-width: 640px) {
  .overview__hero {
    flex-wrap: wrap;
  }

  .overview__metrics {
    grid-template-columns: 1fr;
  }

  .metric + .metric {
    border-left: none;
    border-top: 1px solid var(--td-component-stroke);
  }
}
</style>
