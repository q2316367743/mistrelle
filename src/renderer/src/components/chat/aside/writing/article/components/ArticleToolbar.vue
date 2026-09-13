<template>
  <div class="doc-toolbar">
    <article-version-panel
      :versions="versions"
      :active-version-id="activeVersionId"
      :humanizing="humanizing"
      :streaming-version-id="streamingVersionId"
      @select="(id) => emit('select-version', id)"
      @remove="(id) => emit('remove-version', id)"
    />
    <div class="doc-toolbar__sep" />
    <div class="doc-toolbar__formats">
      <t-tooltip content="加粗">
        <t-button
          size="small"
          variant="text"
          shape="square"
          :disabled="humanizing"
          @click="emit('format', 'bold')"
        >
          <template #icon><textformat-bold-icon /></template>
        </t-button>
      </t-tooltip>
      <t-tooltip content="斜体">
        <t-button
          size="small"
          variant="text"
          shape="square"
          :disabled="humanizing"
          @click="emit('format', 'italic')"
        >
          <template #icon><textformat-italic-icon /></template>
        </t-button>
      </t-tooltip>
      <t-tooltip content="小标题">
        <t-button
          size="small"
          variant="text"
          shape="square"
          class="format-h2"
          :disabled="humanizing"
          @click="emit('format', 'h2')"
        >
          H2
        </t-button>
      </t-tooltip>
      <t-tooltip content="无序列表">
        <t-button
          size="small"
          variant="text"
          shape="square"
          :disabled="humanizing"
          @click="emit('format', 'bulletList')"
        >
          <template #icon><view-list-icon /></template>
        </t-button>
      </t-tooltip>
      <t-tooltip content="引用">
        <t-button
          size="small"
          variant="text"
          shape="square"
          :disabled="humanizing"
          @click="emit('format', 'blockquote')"
        >
          <template #icon><quote-icon /></template>
        </t-button>
      </t-tooltip>
    </div>
    <div class="doc-toolbar__spacer" />
    <div class="doc-toolbar__images">
      <t-button size="small" variant="text" :disabled="humanizing" @click="uploadImage">
        <template #icon><image-add-icon /></template>
        插图
      </t-button>
      <t-tooltip content="登录后可使用生图" :disabled="canGenerate">
        <t-button
          size="small"
          variant="text"
          :disabled="humanizing || !canGenerate"
          @click="emit('gen-image')"
        >
          <template #icon><ai-image-icon /></template>
          生图
        </t-button>
      </t-tooltip>
    </div>
  </div>
</template>
<script lang="ts" setup>
import {
  AiImageIcon,
  ImageAddIcon,
  QuoteIcon,
  TextformatBoldIcon,
  TextformatItalicIcon,
  ViewListIcon
} from 'tdesign-icons-vue-next'
import { useAuthStore } from '@/windows/main/store/AuthStore'
import type { ArticleVersion } from '@/windows/main/modules/tool/components/article/articleTypes'
import { copyImageToAssets, resolveAssetRel } from '@/windows/main/modules/tool/components/article/imageRef'
import { MessageUtil } from '@/utils/modal'
import ArticleVersionPanel from './ArticleVersionPanel.vue'

/** 编辑器格式命令（ArticleAside 转发给编辑器实例执行） */
type ArticleFormatCmd = 'bold' | 'italic' | 'h2' | 'bulletList' | 'blockquote'

const props = defineProps<{
  versions: ArticleVersion[]
  activeVersionId: string
  humanizing?: boolean
  streamingVersionId?: string | null
  /** 配图目录（插图上传落盘于此） */
  assetsDir: string
  /** 当前文章 md 所在目录（相对引用计算基准） */
  baseDir: string
}>()

const emit = defineEmits<{
  (e: 'format', cmd: ArticleFormatCmd): void
  /** 插入图片（rel 为相对 md 目录的引用路径，插入光标处） */
  (e: 'insert', rel: string): void
  (e: 'gen-image'): void
  (e: 'select-version', versionId: string): void
  (e: 'remove-version', versionId: string): void
}>()

/** 生图门控：登录即可用（直出接口，积分由服务端扣减） */
const canGenerate = computed(() => useAuthStore().status === 'signed-in')

/** 系统选图 → 拷入 assets → 插入光标处 */
const uploadImage = async (): Promise<void> => {
  const selected = await window.preload.inject.dialog.open({
    properties: ['openFile'],
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
  })
  const src = selected?.[0]
  if (!src) return
  try {
    const absPath = await copyImageToAssets(props.assetsDir, src, 'image')
    emit('insert', resolveAssetRel(props.baseDir, absPath))
  } catch {
    MessageUtil.error('图片复制失败')
  }
}
</script>
<style scoped lang="less">
.doc-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--td-border-level-1-color);
  background: var(--td-bg-color-container);

  &__sep {
    width: 1px;
    height: 16px;
    margin: 0 4px;
    background: var(--td-border-level-1-color);
  }

  &__formats {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  &__spacer {
    flex: 1;
  }

  &__images {
    display: flex;
    align-items: center;
    gap: 2px;
  }
}

.format-h2 {
  font-size: var(--td-font-size-body-small);
  font-weight: 600;
}
</style>
