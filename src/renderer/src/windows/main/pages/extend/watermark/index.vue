<template>
  <page-layout title="打水印">
    <template #extra>
      <div v-if="source" class="flex items-center gap-8px">
        <t-button variant="outline" @click="pickImage">
          <template #icon><swap-icon /></template>
          更换图片
        </t-button>
        <t-popconfirm content="将清空当前图片与已打码的标记，确定吗？" @confirm="clearImage">
          <t-button variant="outline">
            <template #icon><delete-icon /></template>
            清空图片
          </t-button>
        </t-popconfirm>
      </div>
    </template>

    <div class="watermark-page">
      <div
        v-if="!source"
        class="watermark-page__empty"
        :class="{ 'is-dragover': dragging }"
        @click="pickImage"
        @dragover.prevent="dragging = true"
        @dragleave="handleDragLeave"
        @drop.prevent="handleDrop"
      >
        <image-icon class="watermark-page__empty-icon" />
        <p class="watermark-page__empty-title">上传一张图片</p>
        <p class="watermark-page__empty-tip">自动识别文字后可勾选打码，也能手动涂抹</p>
        <t-button theme="primary" @click.stop="pickImage">
          <template #icon><image-add-icon /></template>
          选择图片
        </t-button>
        <p class="watermark-page__empty-note">也可以直接把图片拖到这里</p>
      </div>

      <!-- key 随选图递增：换图后图片 / OCR / 标记全部重来 -->
      <mosaic-editor
        v-else
        :key="sourceKey"
        class="watermark-page__editor"
        :source="source"
        :apply="applyExport"
        apply-label="导出图片"
      />
    </div>
  </page-layout>
</template>
<script lang="ts" setup>
import { DeleteIcon, ImageAddIcon, ImageIcon, SwapIcon } from 'tdesign-icons-vue-next'
import { MessageUtil } from '@/utils/modal'
import MosaicEditor from '@/windows/main/components/mosaic/MosaicEditor.vue'
import type { MosaicApplyPayload } from '@/windows/main/components/mosaic/useMosaicEditor'
import { WATERMARK_IMAGE_EXTS, exportMosaicImage } from './mosaicExport'

/** 打水印：上传图片 → OCR 勾选 / 手动涂抹打码 → 导出带遮盖的整图（原图不动） */
defineOptions({ name: 'ExtendWatermarkPage' })

const source = ref('')
/** 换图计数：驱动编辑器重挂载 */
const sourceKey = ref(0)
const dragging = ref(false)

/** 应用出口：烘焙导出（成功 / 失败提示都在 exportMosaicImage 内） */
const applyExport = (payload: MosaicApplyPayload) => exportMosaicImage(source.value, payload)

const openImage = (path: string | undefined) => {
  if (!path) return
  const ext = window.preload.path.extname(path).replace('.', '').toLowerCase()
  if (!WATERMARK_IMAGE_EXTS.includes(ext)) {
    MessageUtil.warning(`不支持的图片格式：${ext || '未知'}`)
    return
  }
  source.value = path
  sourceKey.value += 1
}

const pickImage = async () => {
  const paths = await window.preload.inject.dialog.open({
    title: '选择图片',
    properties: ['openFile'],
    filters: [{ name: '图片', extensions: WATERMARK_IMAGE_EXTS }]
  })
  openImage(paths?.[0])
}

/** 清空图片：回到上传空态（OCR 结果与标记都活在编辑器内部，随其卸载一起丢弃） */
const clearImage = () => {
  source.value = ''
}

/** 拖入图片：Electron 32+ 已移除 File.path，磁盘路径只能经 webUtils 还原 */
const handleDrop = (e: DragEvent) => {
  dragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  openImage(window.preload.webUtils.getPathForFile(file))
}

/** 只在真正离开卡片时收起高亮（掠过子元素也会冒泡出 dragleave） */
const handleDragLeave = (e: DragEvent) => {
  if (e.target === e.currentTarget) dragging.value = false
}
</script>
<style scoped lang="less">
.watermark-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 8px;
  box-sizing: border-box;

  &__empty {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 24px;
    cursor: pointer;
    border: 1px dashed var(--td-border-level-2-color);
    border-radius: var(--td-radius-large);
    background: var(--td-bg-color-container);
    transition: border-color 0.2s ease-in-out, background-color 0.2s ease-in-out;

    &.is-dragover {
      border-color: var(--td-brand-color);
      background: var(--td-brand-color-light);
    }
  }

  &__empty-icon {
    font-size: 40px;
    color: var(--td-text-color-placeholder);
  }

  &__empty-title {
    font-size: var(--td-font-size-title-medium);
    color: var(--td-text-color-primary);
  }

  &__empty-tip,
  &__empty-note {
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-secondary);
  }

  &__empty-note {
    color: var(--td-text-color-placeholder);
  }

  &__editor {
    flex: 1;
    min-height: 0;
  }
}
</style>
