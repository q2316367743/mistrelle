<template>
  <page-layout title="Markdown 卡片">
    <template #extra>
      <t-button :disabled="exporting" @click="handleExport">
        <template #icon><download-icon /></template>
        {{ exporting ? '导出中...' : pageCount > 1 ? `导出卡片（${pageCount} 张）` : '导出卡片' }}
      </t-button>
    </template>
    <div class="md-card-page">
      <aside class="md-card-page__editor">
        <MarkdownEditorPanel />
      </aside>
      <main class="md-card-page__preview">
        <div class="md-card-page__preview-inner">
          <span class="md-card-page__hint">
            实时预览 · 3:4 比例 · 长文自动分页{{ pageCount > 1 ? ` · 共 ${pageCount} 页` : '' }}
          </span>
          <MarkdownPreview
            ref="previewRef"
            :content="state.content"
            :raw-style-props="styleProps"
            :template="styleFree.template"
            :css="styleFree.css"
            :author="state.nickname"
            :date="state.dateStr"
            :avatar="state.avatar"
            :watermark="state.watermark"
            @pages-change="pageCount = $event"
          />
        </div>
      </main>
    </div>
  </page-layout>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { DownloadIcon } from 'tdesign-icons-vue-next'
import { MessageUtil } from '@/utils/modal'
import { useCardStyleStore } from '@/windows/main/store'
import { buildDefaultCardStyleProps, normalizeCardStyleProps } from '@/global/card-style-props'
import { state } from './state'
import MarkdownEditorPanel from './components/MarkdownEditorPanel.vue'
import MarkdownPreview from './components/MarkdownPreview.vue'

/**
 * Markdown 卡片主页面：左侧 Markdown 源码编辑，右侧 NoteCardRenderer 富渲染实时预览，
 * 导出走 NoteCardRenderer.exportBlobs（实测分页 + snapdom 截 PNG）。
 */
defineOptions({ name: 'ExtendCardPage' })

const styleStore = useCardStyleStore()
const pageCount = ref(1)
const exporting = ref(false)
const previewRef = ref<InstanceType<typeof MarkdownPreview> | null>(null)

/** 选中风格 props（缺键补齐）；未选风格用默认预设全部 fallback */
const styleProps = computed(() => {
  const base = styleStore.getById(state.styleId)?.props
  return base ? normalizeCardStyleProps(base) : buildDefaultCardStyleProps()
})

/** 选中风格的自由层（模板 + 自定义 CSS；未选风格为空 = 默认骨架） */
const styleFree = computed(() => {
  const style = styleStore.getById(state.styleId)
  return { template: style?.template ?? '', css: style?.css ?? '' }
})

const download = (href: string, name: string) => {
  const anchor = document.createElement('a')
  anchor.download = name
  anchor.href = href
  anchor.click()
}

const handleExport = async () => {
  const preview = previewRef.value
  if (!preview) return
  exporting.value = true
  try {
    const urls = await preview.exportPngs(3)
    if (!urls.length) return
    const ts = Date.now()
    if (urls.length === 1) {
      download(urls[0], `md-card-${ts}.png`)
    } else {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      urls.forEach((url, i) =>
        zip.file(`md-card-${i + 1}.png`, url.split(',')[1], { base64: true })
      )
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      download(url, `md-cards-${ts}.zip`)
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    }
  } catch (e) {
    console.error('Export failed:', e)
    MessageUtil.error('导出失败，请重试')
  } finally {
    exporting.value = false
  }
}
</script>

<style scoped lang="less">
.md-card-page {
  display: flex;
  height: calc(100vh - 48px);
  background: var(--td-bg-color-container);

  &__editor {
    width: 45%;
    overflow-y: auto;
    padding: 16px;
    border-right: 1px solid var(--td-component-stroke);
  }

  &__preview {
    width: 55%;
    overflow-y: auto;
    padding: 32px 16px;

    &-inner {
      max-width: 420px;
      margin: 0 auto;
    }
  }

  &__hint {
    display: block;
    text-align: center;
    font-size: 12px;
    color: var(--td-text-color-placeholder);
    margin-bottom: 16px;
  }
}
</style>
