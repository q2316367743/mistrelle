<template>
  <div class="aihot-timeline">
    <div v-for="group in groups" :key="group.key" class="aihot-timeline__group">
      <div class="aihot-timeline__head">
        <span class="aihot-timeline__label">{{ group.label }}</span>
        <span class="aihot-timeline__count">{{ group.items.length }} 条</span>
      </div>
      <div class="aihot-timeline__list">
        <div v-for="item in group.items" :key="item.id" class="aihot-timeline__row">
          <span class="aihot-timeline__time">{{ aihotTimelineTime(item, by) }}</span>
          <span class="aihot-timeline__dot" />
          <aihot-item-card
            :item="item"
            :show-selected="showSelected"
            class="aihot-timeline__card"
          />
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import type { AihotTimelineGroup } from '../aihot-page-utils'
import { aihotTimelineTime } from '../aihot-page-utils'
import AihotItemCard from './AihotItemCard.vue'

defineProps<{
  /** 已按时间倒序分好的日期组 */
  groups: Array<AihotTimelineGroup>
  /** 时间列与分组所用基准：timeline=discoveredAt，published=publishedAt */
  by: 'timeline' | 'published'
  showSelected?: boolean
}>()
</script>
<style scoped lang="less">
// 时间列宽 40px + 间距 12px + 圆点半径 4.5px = 竖线中心 56.5px
@timeline-axis: 56px;

.aihot-timeline {
  display: flex;
  flex-direction: column;
  gap: 4px;

  &__head {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0 6px;
    background-color: var(--td-bg-color-container);
  }

  &__label {
    font: var(--td-font-title-small);
    font-weight: 700;
    color: var(--td-text-color-primary);
    padding-left: 8px;
    border-left: 3px solid var(--td-brand-color);
  }

  &__count {
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }

  &__list {
    position: relative;

    // 竖直时间线（穿过整组，圆点叠加其上）
    &::before {
      content: '';
      position: absolute;
      left: @timeline-axis;
      top: 16px;
      bottom: 16px;
      width: 1px;
      background-color: var(--td-component-stroke);
    }
  }

  &__row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 5px 0;
  }

  &__time {
    width: 40px;
    flex-shrink: 0;
    text-align: right;
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
    padding-top: 13px;
  }

  &__dot {
    width: 9px;
    height: 9px;
    flex-shrink: 0;
    margin-top: 15px;
    border-radius: var(--td-radius-circle);
    border: 2px solid var(--td-brand-color);
    background-color: var(--td-bg-color-container);
    position: relative;
    z-index: 1;
  }

  &__card {
    flex: 1;
    min-width: 0;
  }
}
</style>
