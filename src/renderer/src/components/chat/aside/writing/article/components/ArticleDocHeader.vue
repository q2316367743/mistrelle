<template>
  <div class="doc-header">
    <div class="doc-header__top">
      <article-cover-thumb
        :cover="entry?.cover"
        :assets-dir="assetsDir"
        :locked="locked"
        @cover="(rel) => emit('patch-type', { cover: rel })"
      />
      <t-select
        class="doc-header__title"
        :value="article.id"
        :options="articleOptions"
        borderless
        placeholder="文章标题"
        @change="onArticleChange"
      />
      <t-select
        class="doc-header__type w-100px"
        :value="activeType || undefined"
        :options="typeOptions"
        borderless
        placeholder="无类型"
        :disabled="!article.types.length"
        @change="onTypeChange"
      />
      <t-button
        variant="text"
        shape="square"
        title="刷新（读取磁盘最新内容）"
        @click="emit('refresh')"
      >
        <template #icon><refresh-icon /></template>
      </t-button>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { RefreshIcon } from 'tdesign-icons-vue-next'
import type {
  ArticleItem,
  ArticleTypePatch
} from '@/windows/main/modules/tool/components/article/articleTypes'
import ArticleCoverThumb from './ArticleCoverThumb.vue'

const props = defineProps<{
  article: ArticleItem
  /** 项目内全部文章（标题下拉切换） */
  articles: ArticleItem[]
  /** 当前激活类型（平台）；'' 表示文章尚无类型 */
  activeType: string
  /** 当前类型条目（封面来源） */
  entry?: { cover?: string }
  /** 配图目录（assets/ 绝对路径） */
  assetsDir: string
  /** 流式改写进行中锁定 */
  locked?: boolean
}>()

const emit = defineEmits<{
  (e: 'patch-type', patch: ArticleTypePatch): void
  (e: 'switch-article', id: string): void
  (e: 'switch-type', type: string): void
  (e: 'refresh'): void
}>()

// ─── 标题：select 下拉切换文章（标题只能由 AI 经 article_update 修改） ─

const articleOptions = computed(() =>
  props.articles.map((a) => ({ label: a.title || a.id, value: a.id }))
)

const onArticleChange = (value: unknown): void => {
  if (typeof value === 'string' && value !== props.article.id) emit('switch-article', value)
}

// ─── 类型：标题旁下拉选择项（类型由 AI 设定，这里只切换） ──────────

const typeOptions = computed(() =>
  props.article.types.map((t) => ({ label: t.type, value: t.type }))
)

const onTypeChange = (value: unknown): void => {
  if (typeof value === 'string') emit('switch-type', value)
}
</script>
<style scoped lang="less">
.doc-header {
  padding: 8px 8px 8px;
  border-bottom: 1px solid var(--td-border-level-1-color);
  background: var(--td-bg-color-container);
}

.doc-header__top {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.doc-header__title {
  flex: 1;
  min-width: 0;

  :deep(.t-input__inner) {
    font-size: var(--td-font-size-title-medium);
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  :deep(.t-input__suffix-icon) {
    color: var(--td-text-color-placeholder);
  }
}

.doc-header__type {
  flex-shrink: 0;
}
</style>
