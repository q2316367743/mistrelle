<template>
  <article-doc-actions
    :humanizing="humanizing"
    :words="words"
    :versions="versions"
    :active-version-id="activeVersionId"
    @humanize="emit('humanize')"
    @abort="emit('abort')"
    @copy="emit('copy')"
    @detect="emit('detect')"
    @reveal="emit('reveal')"
    @compare="(id: string) => emit('compare', id)"
  >
    <template #extra>
      <t-button
        size="small"
        variant="text"
        :disabled="humanizing"
        @click="emit('open-panel', 'layout')"
      >
        <template #icon><mode-preview-icon /></template>
        排版预览
      </t-button>
      <t-button
        size="small"
        variant="text"
        :disabled="humanizing"
        @click="emit('open-panel', 'qc')"
      >
        <template #icon><fact-check-icon /></template>
        正文质检
      </t-button>
    </template>
  </article-doc-actions>
</template>
<script lang="ts" setup>
import { FactCheckIcon, ModePreviewIcon } from 'tdesign-icons-vue-next'
import type { ArticleVersion } from '@/windows/main/modules/tool/components/article/articleTypes'
import ArticleDocActions from '../../article/components/ArticleDocActions.vue'

defineProps<{
  /** 去 AI 味流式进行中 */
  humanizing?: boolean
  /** 实时字数（编辑器内容即时统计） */
  words: number
  /** 当前类型版本列表（供版本对比下拉） */
  versions?: ArticleVersion[]
  /** 当前激活版本 id */
  activeVersionId?: string
}>()

const emit = defineEmits<{
  (e: 'humanize'): void
  (e: 'abort'): void
  (e: 'copy'): void
  (e: 'detect'): void
  (e: 'reveal'): void
  (e: 'compare', versionId: string): void
  (e: 'open-panel', panel: 'layout' | 'qc'): void
}>()
</script>
