<template>
  <div class="aihot-daily">
    <div class="aihot-daily__header">
      <span class="aihot-daily__date">{{ report.date }} 日报</span>
      <span class="aihot-daily__window">
        覆盖 {{ report.windowStart }} ~ {{ report.windowEnd }}
      </span>
      <span class="aihot-daily__generated">生成于 {{ aihotDateTime(report.generatedAt) }}</span>
    </div>
    <div v-if="report.attribution" class="aihot-daily__attr">
      转载自 {{ report.attribution.name }}
    </div>

    <div v-if="report.lead" class="aihot-daily__lead">
      <div class="aihot-daily__lead-title">{{ report.lead.title }}</div>
      <div class="aihot-daily__lead-body">{{ report.lead.leadParagraph }}</div>
    </div>

    <template v-for="section in report.sections" :key="section.label">
      <div class="aihot-daily__section">
        <div class="aihot-daily__section-label">{{ section.label }}</div>
        <div
          v-for="(item, index) in section.items"
          :key="`${section.label}-${index}`"
          class="aihot-daily__item"
          @click="openLink(item.links.original)"
        >
          <div class="aihot-daily__item-title" :title="item.title">{{ item.title }}</div>
          <div v-if="item.summary" class="aihot-daily__item-summary">{{ item.summary }}</div>
          <div class="aihot-daily__item-meta">
            <span>{{ item.source.name }}</span>
            <span v-if="item.attribution">转载自 {{ item.attribution.name }}</span>
          </div>
        </div>
      </div>
    </template>

    <div v-if="report.flashes.length > 0" class="aihot-daily__section">
      <div class="aihot-daily__section-label">快讯</div>
      <div
        v-for="(flash, index) in report.flashes"
        :key="`flash-${index}`"
        class="aihot-daily__flash"
        @click="openLink(flash.links.original)"
      >
        <span class="aihot-daily__flash-time">{{ aihotRelativeTime(flash.publishedAt) }}</span>
        <span class="aihot-daily__flash-title" :title="flash.title">{{ flash.title }}</span>
        <span class="aihot-daily__flash-source">{{ flash.source.name }}</span>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import type { AihotDailyReport as AihotDailyReportData } from '@/modules/api/aihot'
import { aihotDateTime, aihotRelativeTime } from '../aihot-page-utils'

defineProps<{
  report: AihotDailyReportData
}>()

const openLink = (url: string) => window.preload.inject.shell.openExternal(url)
</script>
<style scoped lang="less">
.aihot-daily {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 16px;

  &__header {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  &__date {
    font: var(--td-font-title-medium);
    font-weight: 700;
    color: var(--td-text-color-primary);
  }

  &__window,
  &__generated,
  &__attr {
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }

  &__lead {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 16px;
    border: 1px solid var(--td-brand-color);
    border-radius: var(--td-radius-medium);
    background-color: var(--td-brand-color-light);
  }

  &__lead-title {
    font: var(--td-font-body-large);
    font-weight: 700;
    color: var(--td-text-color-primary);
  }

  &__lead-body {
    font: var(--td-font-body-medium);
    line-height: 1.7;
    color: var(--td-text-color-secondary);
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__section-label {
    font: var(--td-font-title-small);
    font-weight: 700;
    color: var(--td-text-color-primary);
    padding-left: 8px;
    border-left: 3px solid var(--td-brand-color);
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

  &__item-title {
    font: var(--td-font-body-medium);
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  &__item-summary {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    overflow: hidden;
    font: var(--td-font-body-small);
    line-height: 1.6;
    color: var(--td-text-color-secondary);
  }

  &__item-meta {
    display: flex;
    gap: 12px;
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }

  &__flash {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    border-radius: var(--td-radius-medium);
    cursor: pointer;
    transition: background-color var(--fluent-transition-fast);

    &:hover {
      background-color: var(--td-bg-color-container-hover);
    }
  }

  &__flash-time {
    flex-shrink: 0;
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }

  &__flash-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font: var(--td-font-body-small);
    color: var(--td-text-color-primary);
  }

  &__flash-source {
    flex-shrink: 0;
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }
}
</style>
