<template>
  <page-layout title="文生图">
    <div class="image-page">
      <div class="generate-panel">
        <image-generate-form @submit="handleSubmit" />
      </div>
      <image-record-grid
        v-model:keyword="keyword"
        :items="list"
        :total="total"
        :init-loading="initLoading"
        :more-loading="moreLoading"
        :has-more="hasMore"
        @open="handleOpen"
        @retry="handleRetry"
        @delete="handleDelete"
        @load-more="loadMore"
      />
    </div>
  </page-layout>
</template>

<script lang="ts" setup>
import { useImageGenerations } from './useImageGenerations'
import { openImageDetail } from './components/ImageDetailDrawer'
import type { ImageFormSubmit } from './image-page-utils'
import ImageGenerateForm from './components/ImageGenerateForm.vue'
import ImageRecordGrid from './components/ImageRecordGrid.vue'

const {
  list,
  total,
  keyword,
  initLoading,
  moreLoading,
  hasMore,
  refresh,
  loadMore,
  generate,
  remove,
  resumeRetry,
  init
} = useImageGenerations()

onMounted(() => init())

watchDebounced(keyword, () => refresh(), { debounce: 400 })

const handleSubmit = (form: ImageFormSubmit) => generate(form)

// eslint-disable-next-line no-undef
const handleOpen = (record: ImageRecordInput) => {
  openImageDetail(record, {
    onRetry: (r) => resumeRetry(r),
    onDeleted: (id) => remove(id)
  })
}

// eslint-disable-next-line no-undef
const handleRetry = (record: ImageRecordInput) => resumeRetry(record)

// eslint-disable-next-line no-undef
const handleDelete = (record: ImageRecordInput) => remove(record.id)
</script>

<style scoped lang="less">
.image-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: calc(100% - 16px);
  min-height: 0;
  padding: 8px;
}

.generate-panel {
  flex-shrink: 0;
  padding: 16px;
  border: 1px solid var(--td-component-border);
  border-radius: 12px;
  background: var(--td-bg-color-container);
}
</style>
