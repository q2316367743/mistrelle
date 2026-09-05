<template>
  <page-layout title="笔记卡片">
    <template #extra>
      <t-button :disabled="exporting" @click="handleExport">
        <template #icon>
          <download-icon />
        </template>
        {{ exporting ? '导出中...' : pageCount > 1 ? `导出卡片（${pageCount} 张）` : '导出卡片' }}
      </t-button>
    </template>
    <div class="xhs-studio xhs-page">
      <div class="shutter-flash" :class="{ active: flashing }" />
      <main class="note-card">
        <div class="editor-panel">
          <EditorPanel />
        </div>
        <div class="preview-card">
          <div class="preview-card__wrapper">
            <span class="text-xs text-[#888] tracking-wide pb-32px">
              实时预览 · 3:4 比例 · 长图自动加长{{ pageCount > 1 ? ` · 共 ${pageCount} 页` : '' }}
            </span>
            <ErrorBoundary>
              <PreviewCard
                :content="state.content"
                :nickname="state.nickname"
                :date-str="state.dateStr"
                :avatar="state.avatar"
                :images="state.images"
                :watermark="state.watermark"
                :runtime="runtime"
                @pages-change="pageCount = $event"
              />
            </ErrorBoundary>
          </div>
        </div>
      </main>
    </div>
  </page-layout>
</template>

<script lang="ts" setup>
import './xhs/xhs-studio.css'
import { DownloadIcon } from 'tdesign-icons-vue-next'
import { MessageUtil } from '@/utils/modal'
import { useCardStyleStore } from '@/windows/main/store'
import { normalizeCardStyleProps } from '@/global/card-style-props'
import EditorPanel from './xhs/EditorPanel.vue'
import PreviewCard from './xhs/PreviewCard.vue'
import ErrorBoundary from './xhs/ErrorBoundary.vue'
import { state } from './xhs/state'
import { buildXhsRuntime, DEFAULT_RUNTIME } from './xhs/protocol'
import { exportXhsCards } from './xhs/exporter'

/**
 * 笔记卡片：jinsan.ok.kimi.link（XHS Card Studio）的 1:1 移植，
 * 唯一增量是 EditorPanel 顶部的「卡片风格」选择（注册表 → 绘制/预览运行时参数）。
 */
defineOptions({ name: 'ExtendCardPage' })

const styleStore = useCardStyleStore()
const pageCount = ref(1)
const exporting = ref(false)
const flashing = ref(false)

const runtime = computed(() => {
  if (!state.styleId) return DEFAULT_RUNTIME
  const style = styleStore.getById(state.styleId)
  return buildXhsRuntime(normalizeCardStyleProps(style?.props))
})

const download = (href: string, name: string) => {
  const anchor = document.createElement('a')
  anchor.download = name
  anchor.href = href
  anchor.click()
}

const handleExport = () => {
  exporting.value = true
  flashing.value = true
  setTimeout(() => (flashing.value = false), 300)
  setTimeout(async () => {
    try {
      const dataUrls = await exportXhsCards({
        content: state.content,
        nickname: state.nickname,
        dateStr: state.dateStr,
        avatar: state.avatar ?? undefined,
        images: state.images,
        watermark: state.watermark,
        runtime: runtime.value
      })
      const ts = Date.now()
      if (dataUrls.length === 1) {
        download(dataUrls[0], `xhs-card-${ts}.png`)
      } else {
        const { default: JSZip } = await import('jszip')
        const zip = new JSZip()
        dataUrls.forEach((url, i) =>
          zip.file(`xhs-card-${i + 1}.png`, url.split(',')[1], { base64: true })
        )
        const blob = await zip.generateAsync({ type: 'blob' })
        const url = URL.createObjectURL(blob)
        download(url, `xhs-cards-${ts}.zip`)
        setTimeout(() => URL.revokeObjectURL(url), 5000)
      }
    } catch (e) {
      console.error('Export failed:', e)
      MessageUtil.error('导出失败，请重试')
    } finally {
      exporting.value = false
    }
  }, 350)
}

// ------------------------------ 参考站自定义光标（1:1） ------------------------------
let cursorCleanup: (() => void) | null = null

onBeforeUnmount(() => {
  cursorCleanup?.()
  cursorCleanup = null
  document.head.querySelectorAll('link[href*="fonts.loli.net"]').forEach((el) => el.remove())
})
</script>

<style scoped lang="less">
// 参考站 header 是 viewport fixed；嵌入应用内容区改为容器内 sticky，视觉行为一致
.xhs-page .xhs-header {
  position: sticky;
}

.xhs-page {
  background: var(--td-bg-color-container);
}

.note-card {
  height: calc(100vh - 48px);
  width: 100%;
  display: flex;
}

.editor-panel {
  width: 45%;
  overflow-y: auto;
  padding: 16px;
}
.preview-card {
  width: 55%;
  overflow-y: auto;
  padding-top: 5vh;
  .preview-card__wrapper {
    display: flex;
    justify-content: center;
    flex-direction: column;
    align-items: center;
  }
}
</style>
