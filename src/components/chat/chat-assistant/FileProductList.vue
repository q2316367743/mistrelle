<template>
  <div v-if="products.length" class="file-products">
    <div class="products-label">产物</div>
    <div class="products-list">
      <div
        v-for="file in products"
        :key="file.fullPath"
        class="product-card"
        @click="openFilePreview(file)"
      >
        <FileCodeIcon v-if="isCodeFile(file.fullPath)" class="product-icon" />
        <FileImageIcon v-else-if="isImageFile(file.fullPath)" class="product-icon" />
        <VideoIcon v-else-if="isVideoFile(file.fullPath)" class="product-icon" />
        <FileMusicIcon v-else-if="isAudioFile(file.fullPath)" class="product-icon" />
        <FileExcelIcon v-else-if="file.fullPath.endsWith('.xls')" class="product-icon" />
        <FileExcelIcon v-else-if="file.fullPath.endsWith('.xlsx')" class="product-icon" />
        <FileWordIcon v-else-if="file.fullPath.endsWith('.doc')" class="product-icon" />
        <FileWordIcon v-else-if="file.fullPath.endsWith('.docx')" class="product-icon" />
        <FileMarkdownIcon v-else-if="file.fullPath.endsWith('.md')" class="product-icon" />
        <FileIcon v-else class="product-icon" />
        <span class="product-name">{{ file.fileName }}</span>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import type { AIMessage, ToolCallContent } from '@/domain'
import { FileCodeIcon, FileExcelIcon, FileIcon, FileImageIcon, FileMarkdownIcon, FileMusicIcon, FileWordIcon, VideoIcon } from 'tdesign-icons-vue-next'
import { openFilePreview, type ProductFile } from './modals/FilePreviewDialog'

const props = defineProps({
  message: {
    type: Object as PropType<AIMessage>,
    required: true
  }
})

const toolCallNames = ['file_write_xlsx', 'file_write']

const products = computed<ProductFile[]>(() => {
  if (!props.message.content) return []
  const result: ProductFile[] = []
  for (const item of props.message.content) {
    if (item.type !== 'toolcall' || item.status !== 'complete') continue
    const tc = item as ToolCallContent
    if (!toolCallNames.includes(tc.data.toolCallName)) continue
    const args = tc.data.args
    if (!args) continue
    try {
      const parsed = JSON.parse(args)
      const fullPath: string = parsed.path ?? ''
      if (!fullPath) continue
      const fileName = fullPath.split('/').pop() || fullPath.split('\\').pop() || fullPath
      result.push({ fileName, fullPath })
    } catch {
      // ignore parse errors
    }
  }
  return result
})

const CODE_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.vue', '.json', '.css', '.less', '.html',
  '.py', '.rs', '.go', '.java', '.c', '.cpp', '.h', '.hpp', '.yaml', '.yml',
  '.toml', '.xml', '.sh', '.bat', '.cmd', '.sql', '.rb', '.php',
  '.swift', '.kt', '.dart', '.scss', '.sass', '.styl', '.pl', '.lua', '.r',
  '.groovy', '.tex', '.ini', '.cfg', '.conf', '.env', '.gradle', '.tf',
])

const IMAGE_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp', '.avif',
])

const VIDEO_EXTS = new Set([
  '.mp4', '.webm', '.avi', '.mov', '.mkv', '.wmv', '.flv',
])

const AUDIO_EXTS = new Set([
  '.mp3', '.wav', '.ogg', '.flac', '.aac', '.wma', '.m4a', '.opus',
])

function getExt(path: string) {
  const i = path.lastIndexOf('.')
  return i >= 0 ? path.slice(i).toLowerCase() : ''
}

function isCodeFile(path: string) {
  return CODE_EXTS.has(getExt(path))
}

function isImageFile(path: string) {
  return IMAGE_EXTS.has(getExt(path))
}

function isVideoFile(path: string) {
  return VIDEO_EXTS.has(getExt(path))
}

function isAudioFile(path: string) {
  return AUDIO_EXTS.has(getExt(path))
}
</script>
<style scoped lang="less">
.file-products {
  margin-top: var(--td-comp-margin-m);
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-border);
  padding: 9px 9px 12px;
}

.products-label {
  font: var(--td-font-body-small);
  color: var(--td-text-color-placeholder);
  margin-bottom: var(--td-comp-margin-xs);
  user-select: none;
}

.products-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--td-comp-margin-s);
}

.product-card {
  display: inline-flex;
  align-items: center;
  gap: var(--td-comp-margin-xs);
  padding: var(--td-comp-paddingTB-xxs) var(--td-comp-paddingLR-s);
  border-radius: var(--td-radius-default);
  border: 1px solid var(--td-component-border);
  background: var(--td-bg-color-secondarycontainer);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.product-card:hover {
  border-color: var(--td-brand-color);
  background: var(--td-brand-color-light);
  transform: translateY(-1px);
  box-shadow: var(--td-shadow-1);
}

.product-card:active {
  transform: translateY(0);
  box-shadow: none;
}

.product-icon {
  flex-shrink: 0;
  font-size: 14px;
  color: var(--td-brand-color);
  transition: transform 0.2s ease;
}

.product-card:hover .product-icon {
  transform: scale(1.1);
}

.product-name {
  font: var(--td-font-body-small);
  font-family: var(--td-font-family-mono, 'Cascadia Code', 'Fira Code', 'Consolas', monospace);
  color: var(--td-text-color-primary);
  white-space: nowrap;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
