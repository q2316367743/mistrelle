<template>
  <div class="article-list">
    <div v-if="articles.length === 0" class="article-list__empty">
      暂无文章，点击 + 新建
    </div>
    <div
      v-for="article in articles"
      :key="article.id"
      class="article-list__item"
      :class="{ 'article-list__item--active': article.id === activeId }"
      @click="$emit('select', article.id)"
    >
      <div class="article-list__row">
        <span class="article-list__title">{{ article.title }}</span>
      </div>
      <div class="article-list__meta">
        <t-tag size="small" :theme="platformTheme(article.platform)" variant="light">
          {{ article.platform }}
        </t-tag>
        <t-tag size="small" :theme="statusTheme(article.status)" variant="outline">
          {{ statusLabel(article.status) }}
        </t-tag>
        <span v-if="article.words" class="article-list__words">{{ article.words }} 字</span>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import type { ArticleItem, ArticlePlatform, ArticleStatus } from '@/modules/tool/components/article/articleTypes'

defineProps<{
  articles: ArticleItem[]
  activeId: string
}>()

defineEmits<{
  (e: 'select', id: string): void
}>()

const PLATFORM_THEME: Record<ArticlePlatform, 'primary' | 'warning' | 'danger' | 'default'> = {
  公众号: 'primary',
  知乎: 'warning',
  小红书: 'danger',
  其他: 'default'
}

const STATUS_THEME: Record<ArticleStatus, 'default' | 'warning' | 'success'> = {
  draft: 'default',
  writing: 'warning',
  done: 'success'
}

const STATUS_LABEL: Record<ArticleStatus, string> = {
  draft: '草稿',
  writing: '写作中',
  done: '已完稿'
}

const platformTheme = (p: ArticlePlatform) => PLATFORM_THEME[p] ?? 'default'
const statusTheme = (s: ArticleStatus) => STATUS_THEME[s] ?? 'default'
const statusLabel = (s: ArticleStatus) => STATUS_LABEL[s] ?? s
</script>
<style scoped lang="less">
.article-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: auto;

  &__empty {
    color: var(--td-text-color-placeholder);
    font-size: var(--td-font-size-body-small);
    text-align: center;
    padding: 24px 0;
  }

  &__item {
    padding: 8px 10px;
    border-radius: var(--td-radius-medium);
    border: 1px solid transparent;
    cursor: pointer;
    transition: background-color 120ms ease-out, border-color 120ms ease-out;

    &:hover {
      background: var(--td-bg-color-container-hover);
    }

    &--active {
      background: var(--td-brand-color-light);
      border-color: var(--td-brand-color-2, var(--td-brand-color));
    }
  }

  &__row {
    display: flex;
    align-items: center;
  }

  &__title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--td-font-size-body-medium);
    color: var(--td-text-color-primary);
  }

  &__meta {
    margin-top: 6px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__words {
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-placeholder);
  }
}
</style>
