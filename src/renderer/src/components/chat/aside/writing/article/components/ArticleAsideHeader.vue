<template>
  <div class="article-aside-header">
    <t-select
      class="article-aside-header__select"
      :value="activeId"
      placeholder="选择文章"
      :empty="'暂无文章，可让 AI 生成'"
      :popup-props="{ overlayClassName: 'article-select-overlay' }"
      clearable
      @change="(v: unknown) => emit('select', v)"
    >
      <t-option v-for="a in articles" :key="a.id" :value="a.id" :label="a.title">
        <div class="article-aside-header__option">
          <span class="option-title">{{ a.title }}</span>
          <div class="option-meta">
            <t-tag size="small" variant="light" :theme="platformTheme(a.platform)">{{
              a.platform
            }}</t-tag>
            <t-tag size="small" variant="outline" :theme="statusTheme(a.status)">{{
              statusLabel(a.status)
            }}</t-tag>
            <span v-if="a.words" class="option-words">{{ a.words }} 字</span>
          </div>
        </div>
      </t-option>
    </t-select>
    <t-button
      theme="primary"
      variant="text"
      shape="square"
      title="在文件夹中显示"
      @click="emit('reveal')"
    >
      <template #icon><folder-open-icon /></template>
    </t-button>
    <t-button theme="primary" variant="text" shape="square" title="刷新" @click="emit('refresh')">
      <template #icon><refresh-icon /></template>
    </t-button>
    <t-button
      theme="primary"
      variant="text"
      shape="square"
      title="导出为 ZIP（含图片）"
      :disabled="exportDisabled"
      class="mr-8px"
      @click="emit('export')"
    >
      <template #icon><download-icon /></template>
    </t-button>
  </div>
</template>
<script lang="ts" setup>
import { DownloadIcon, FolderOpenIcon, RefreshIcon } from 'tdesign-icons-vue-next'
import type {
  ArticleItem,
  ArticlePlatform,
  ArticleStatus
} from '@/windows/main/modules/tool/components/article/articleTypes'

defineProps<{
  articles: ArticleItem[]
  activeId: string
  /** 导出按钮禁用：未选文章或导出进行中 */
  exportDisabled: boolean
}>()

const emit = defineEmits<{
  (e: 'select', id: unknown): void
  (e: 'reveal'): void
  (e: 'refresh'): void
  (e: 'export'): void
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
.article-aside-header {
  display: flex;
  align-items: center;
  gap: 4px;

  &__select {
    flex: 1;
    min-width: 0;
  }

  &__option {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .option-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .option-meta {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .option-words {
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-placeholder);
  }
}
</style>
