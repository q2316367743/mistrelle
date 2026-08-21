<template>
  <div class="aihot-item-card" @click="openOriginal">
    <div class="aihot-item-card__head">
      <span class="aihot-item-card__title" :title="item.title">{{ item.title }}</span>
      <t-tag v-if="showSelected && item.selected" size="small" theme="primary" variant="light">
        精选
      </t-tag>
      <t-tag v-if="categoryLabel" size="small" variant="outline">{{ categoryLabel }}</t-tag>
    </div>
    <div v-if="item.summary" class="aihot-item-card__summary">{{ item.summary }}</div>
    <div v-if="item.reason" class="aihot-item-card__reason">推荐理由：{{ item.reason }}</div>
    <div class="aihot-item-card__meta">
      <span class="aihot-item-card__source">{{ item.source.name }}</span>
      <span>{{ time }}</span>
      <span v-if="item.score != null" class="aihot-item-card__score">{{ item.score }} 分</span>
      <span v-if="item.attribution" class="aihot-item-card__attr">
        转载自 {{ item.attribution.name }}
      </span>
      <link-icon class="aihot-item-card__link-icon" />
    </div>
  </div>
</template>
<script lang="ts" setup>
import { LinkIcon } from 'tdesign-icons-vue-next'
import type { AihotItem } from '@/modules/api/aihot'
import { aihotCategoryLabel, aihotRelativeTime } from '../aihot-page-utils'

const props = defineProps<{
  item: AihotItem
  /** mode=all 时展示精选标记，selected 模式下全量皆精选无需展示 */
  showSelected?: boolean
}>()

const categoryLabel = computed(() => aihotCategoryLabel(props.item.category))
const time = computed(() => aihotRelativeTime(props.item.publishedAt ?? props.item.discoveredAt))

const openOriginal = () => window.preload.inject.shell.openExternal(props.item.links.original)
</script>
<style scoped lang="less">
.aihot-item-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-medium);
  background-color: var(--td-bg-color-container);
  cursor: pointer;
  transition: background-color var(--fluent-transition-fast), border-color var(--fluent-transition-fast);

  &:hover {
    background-color: var(--td-bg-color-container-hover);

    .aihot-item-card__link-icon {
      opacity: 1;
    }
  }

  &__head {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font: var(--td-font-body-medium);
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  &__summary {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
  }

  &__reason {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 12px;
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);

    .aihot-item-card__source {
      color: var(--td-text-color-secondary);
    }

    .aihot-item-card__score {
      color: var(--td-brand-color);
    }
  }

  &__link-icon {
    margin-left: auto;
    opacity: 0;
    transition: opacity var(--fluent-transition-fast);
  }
}
</style>
