<template>
  <div class="aihot-reports">
    <div class="aihot-reports__label">报道时间线（{{ reports.length }}）</div>
    <div class="aihot-reports__list">
      <div
        v-for="report in reports"
        :key="report.id"
        class="aihot-reports__item"
        @click="openReport(report)"
      >
        <div class="aihot-reports__title" :title="report.title">{{ report.title }}</div>
        <div v-if="report.summary" class="aihot-reports__summary">{{ report.summary }}</div>
        <div class="aihot-reports__meta">
          <span>{{ report.source.name }}</span>
          <t-tag v-if="report.source.firstParty" size="small" theme="primary" variant="light">
            第一方
          </t-tag>
          <span class="aihot-reports__time">{{ aihotDateTime(report.publishedAt) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import type { AihotStoryReport } from '@/windows/main/modules/api/aihot'
import { aihotDateTime } from '../aihot-page-utils'
import { openLinkPreview } from '@/components/preview/LinkPreviewDrawer'

defineProps<{
  reports: Array<AihotStoryReport>
}>()

const openReport = (report: AihotStoryReport) => {
  openLinkPreview(report.links.original || report.links.aihot)
}
</script>
<style scoped lang="less">
.aihot-reports {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__label {
    font: var(--td-font-title-small);
    font-weight: 700;
    color: var(--td-text-color-primary);
    padding-left: 8px;
    border-left: 3px solid var(--td-brand-color);
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px;
    border: 1px solid var(--td-component-stroke);
    border-radius: var(--td-radius-medium);
    background-color: var(--td-bg-color-container);
    cursor: pointer;
    transition: background-color var(--fluent-transition-fast);

    &:hover {
      background-color: var(--td-bg-color-container-hover);
    }
  }

  &__title {
    font: var(--td-font-body-medium);
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  &__summary {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    overflow: hidden;
    font: var(--td-font-body-small);
    line-height: 1.6;
    color: var(--td-text-color-secondary);
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }

  &__time {
    margin-left: auto;
  }
}
</style>
