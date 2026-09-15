<template>
  <div class="doc-header">
    <div class="doc-header__top">
      <article-cover-thumb
        :cover="entry?.cover"
        :assets-dir="assetsDir"
        :article="article"
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
        class="doc-header__type"
        :value="activeType || undefined"
        :options="typeOptions"
        borderless
        placeholder="无类型"
        :disabled="!article.types.length"
        @change="onTypeChange"
      />
      <t-popup trigger="click" placement="bottom-right" destroy-on-close>
        <t-button variant="text" shape="square" title="标题与文章信息">
          <template #icon><info-circle-icon /></template>
        </t-button>
        <template #content>
          <div class="doc-info-panel">
            <div class="doc-info-panel__section">
              <div class="doc-info-panel__label">标题</div>
              <t-input
                :value="titleDraft"
                placeholder="文章标题"
                @change="onTitleInput"
                @focus="titleFocused = true"
                @blur="onTitleBlur"
                @enter="onTitleEnter"
              />
            </div>
            <div class="doc-info-panel__section">
              <div class="doc-info-panel__label">简介</div>
              <p class="doc-info-panel__text" :class="{ 'is-empty': !article.summary }">
                {{ article.summary || '暂无简介，可让 AI 经 article_update 登记' }}
              </p>
            </div>
            <div class="doc-info-panel__section">
              <div class="doc-info-panel__label">提纲</div>
              <p class="doc-info-panel__text is-preline" :class="{ 'is-empty': !article.outline }">
                {{ article.outline || '暂无提纲，可让 AI 经 article_update 登记' }}
              </p>
            </div>
          </div>
        </template>
      </t-popup>
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
import { InfoCircleIcon, RefreshIcon } from 'tdesign-icons-vue-next'
import type {
  ArticleItem,
  ArticleTypePatch,
  ArticleUpdatePatch
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
  (e: 'patch-article', patch: ArticleUpdatePatch): void
  (e: 'switch-article', id: string): void
  (e: 'switch-type', type: string): void
  (e: 'refresh'): void
}>()

// ─── 文章：select 下拉切换（标题编辑在 ⓘ 面板内） ───────────────────

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

// ─── 标题：简介/提纲面板内直接编辑（本地草稿 + 失焦/回车提交） ────────

const titleDraft = ref('')
const titleFocused = ref(false)

const syncTitle = (): void => {
  titleDraft.value = props.article.title ?? ''
}

// 切换文章时重置草稿；外部（AI 经 article_update）改标题且用户未在编辑时跟随
watch(
  () => [props.article.id, props.article.title] as const,
  () => {
    if (!titleFocused.value) syncTitle()
  },
  { immediate: true }
)

const onTitleInput = (value: unknown): void => {
  titleDraft.value = typeof value === 'string' ? value : String(value ?? '')
}

/** 提交标题：空值不提交（标题为必填且被 AI 当作主题标识），仅回滚草稿 */
const commitTitle = (): void => {
  const next = titleDraft.value.trim()
  if (!next || next === (props.article.title ?? '')) {
    syncTitle()
    return
  }
  emit('patch-article', { title: next })
}

const onTitleBlur = (): void => {
  titleFocused.value = false
  commitTitle()
}

/** 回车提交；中文输入法选词回车不提交（IME 组合态） */
const onTitleEnter = (_value: unknown, context: { e: KeyboardEvent }): void => {
  if (context.e.isComposing) return
  commitTitle()
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
  width: 100px;
}

.doc-info-panel {
  width: 280px;
  max-height: 320px;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  &__label {
    font-size: var(--td-font-size-body-small);
    font-weight: 600;
    color: var(--td-text-color-secondary);
    margin-bottom: 4px;
    &:before {
      content: '';
      display: inline-block;
      width: 4px;
      height: 10px;
      margin-right: 8px;
      background: var(--td-brand-color);
    }
  }

  &__text {
    margin: 0;
    font-size: var(--td-font-size-body-small);
    line-height: 1.7;
    color: var(--td-text-color-primary);
    word-break: break-word;

    &.is-preline {
      white-space: pre-line;
    }

    &.is-empty {
      color: var(--td-text-color-placeholder);
    }
  }
}
</style>
