<template>
  <div class="detail-content">
    <!-- 大图区 -->
    <div class="detail-media">
      <t-image
        v-if="record.status === 'success' && record.path"
        :src="href"
        :alt="record.prompt"
        fit="contain"
        class="detail-image"
        @click="previewVisible = true"
      />
      <div v-else class="detail-fallback">
        <t-loading v-if="record.status === 'pending'" size="small" />
        <ErrorCircleFilledIcon v-else class="fallback-icon" />
        <span>{{ record.status === 'pending' ? '生成中…' : '生成失败，无图片' }}</span>
      </div>
    </div>

    <!-- 操作（紧贴图片下方，主内容优先） -->
    <div class="detail-actions">
      <t-button theme="danger" variant="outline" @click="handleDelete">
        <template #icon><DeleteIcon /></template>
        删除
      </t-button>
      <div class="action-right">
        <t-button v-if="record.status === 'success'" variant="outline" @click="copyImage">
          <template #icon><CopyIcon /></template>
          复制图片
        </t-button>
        <t-button
          v-if="record.status === 'success'"
          variant="outline"
          @click="previewVisible = true"
        >
          <template #icon><Fullscreen1Icon /></template>
          全屏查看
        </t-button>
        <t-button
          v-if="isRetryableFailed(record)"
          theme="primary"
          @click="emit('retry', record)"
        >
          <template #icon><RefreshIcon /></template>
          重试
        </t-button>
      </div>
    </div>

    <!-- 元信息 -->
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">状态</span>
        <span class="info-value">{{ STATUS_TEXT[record.status] }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">尺寸</span>
        <span class="info-value">{{
          record.width && record.height ? `${record.width}×${record.height}` : (record.size ?? '—')
        }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">模型</span>
        <span class="info-value">{{ record.model ?? '—' }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">设计风格</span>
        <span class="info-value">{{ record.styleName ?? '—' }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">时间</span>
        <span class="info-value">{{ formatDateTime(record.createdAt) }}</span>
      </div>
      <div v-if="record.path" class="info-item info-item-wide">
        <span class="info-label">文件</span>
        <t-link theme="primary" class="info-path" @click="showInFolder">
          {{ record.path }}
        </t-link>
      </div>
    </div>

    <!-- 提示词 -->
    <div class="prompt-block">
      <div class="prompt-header">
        <span>提示词</span>
        <t-button variant="text" size="small" theme="primary" @click="copyPrompt">
          <template #icon><CopyIcon /></template>
          复制
        </t-button>
      </div>
      <p class="prompt-text">{{ record.prompt }}</p>
    </div>

    <t-alert v-if="record.status === 'failed' && record.error" theme="error" class="fail-alert">
      {{ record.error }}
    </t-alert>

    <!-- 全屏预览 -->
    <t-image-viewer v-model:visible="previewVisible" :images="[href]" :title="record.prompt" />
  </div>
</template>

<script lang="ts" setup>
import { MessageBoxUtil, MessageUtil } from '@/utils/modal'
import { copyText } from '@/utils/native'
import {
  CopyIcon,
  DeleteIcon,
  ErrorCircleFilledIcon,
  Fullscreen1Icon,
  RefreshIcon
} from 'tdesign-icons-vue-next'
import { formatDateTime, isRetryableFailed, pathToHref } from '../image-page-utils'

const props = defineProps<{
  record: ImageRecordInput
}>()

const emit = defineEmits<{
  retry: [record: ImageRecordInput]
  deleted: [id: string]
  close: []
}>()

const STATUS_TEXT: Record<ImageGenerateStatus, string> = {
  pending: '生成中',
  success: '已生成',
  failed: '失败'
}

const href = computed(() => (props.record.path ? pathToHref(props.record.path) : ''))
const previewVisible = ref(false)

const copyPrompt = async () => {
  await copyText(props.record.prompt)
  MessageUtil.success('提示词已复制')
}

/** 按图片文件路径复制到系统剪贴板（main 侧 nativeImage 读盘） */
const copyImage = async () => {
  if (!props.record.path) return
  try {
    const ok = await window.preload.inject.clipboard.copyImageByPath(props.record.path)
    if (ok) MessageUtil.success('图片已复制，可直接粘贴')
    else MessageUtil.error('复制图片失败：文件不存在或不是有效图片')
  } catch {
    MessageUtil.error('复制图片失败')
  }
}

/** 在系统文件管理器中定位该图片文件（Finder / 资源管理器） */
const showInFolder = () => {
  if (props.record.path) window.preload.inject.shell.showItemInFolder(props.record.path)
}

const handleDelete = async () => {
  try {
    await MessageBoxUtil.confirm(
      props.record.status === 'success'
        ? '确认删除这张图片与生成记录？删除后不可恢复'
        : '确认删除这条生成记录？删除后不可恢复',
      '删除确认'
    )
  } catch {
    return
  }
  emit('deleted', props.record.id)
}
</script>

<style scoped lang="less">
.detail-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-media {
  aspect-ratio: 1 / 1;
  border-radius: 12px;
  overflow: hidden;
  background: var(--td-bg-color-component);
  cursor: zoom-in;

  .detail-image {
    width: 100%;
    height: 100%;
  }
}

.detail-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100%;
  color: var(--td-text-color-placeholder);
}

.fallback-icon {
  font-size: 32px;
  color: var(--td-error-color);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;

  &-wide {
    grid-column: 1 / -1;
  }
}

.info-label {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}

.info-value {
  font-size: 13px;
  color: var(--td-text-color-primary);
}

.info-path {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.prompt-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.prompt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--td-text-color-secondary);
}

.prompt-text {
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--td-bg-color-component);
  font-size: 13px;
  line-height: 1.6;
  color: var(--td-text-color-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.fail-alert {
  margin: 0;
}

.detail-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.action-right {
  display: flex;
  gap: 8px;
}
</style>
