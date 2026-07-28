<template>
  <div class="asset-page">
    <asset-toolbar
      :id="id"
      :selected="selectedKeys"
      :keyword="keyword"
      :sort="sort"
      @search="(v) => (keyword = v)"
      @sort-change="(v) => (sort = v)"
      @uploaded="reload"
      @refresh="reload"
      @batch-delete="handleBatchDelete"
    />
    <asset-table
      :keyword="keyword"
      :sort="sort"
      v-model:selected="selectedKeys"
      @open="openItem"
      @rename="handleRename"
      @delete="handleDelete"
    />
  </div>
</template>

<script lang="ts" setup>
import { inject, ref } from 'vue'
import AssetToolbar from './components/AssetToolbar.vue'
import AssetTable from './components/AssetTable.vue'
import { openFilePreview, type ProductFile } from '@/components/chat/chat-assistant/modals/FilePreviewDialog'
import { MessageBoxUtil, MessageUtil } from '@/utils/modal'
import { projectAssetContextKey } from '@/pages/project/detail/context/projectAssetContext'

interface SortOption {
  by: 'name' | 'size' | 'mtime'
  order: 'asc' | 'desc'
}

const props = defineProps<{ id: string }>()

const selectedKeys = ref<string[]>([])
const keyword = ref('')
const sort = ref<SortOption>({ by: 'name', order: 'asc' })
const assetContext = inject(projectAssetContextKey)
if (!assetContext) throw new Error('Project asset context is required')

const reload = () => {
  assetContext.refresh().catch((e) => MessageUtil.error('刷新资产失败', e))
}

const openItem = (item: FileItem) => {
  if (item.isDirectory) return
  openFilePreview({ fileName: item.name, fullPath: item.path } as ProductFile)
}

const handleRename = async (item: FileItem) => {
  const { openAssetRenameDialog } = await import('./modals/AssetRenameDialog')
  openAssetRenameDialog({ current: item })
  reload()
}

const handleDelete = async (item: FileItem) => {
  try {
    await MessageBoxUtil.confirm(
      `确认删除「${item.name}」？删除后不可恢复`,
      item.isDirectory ? '删除文件夹' : '删除文件'
    )
  } catch {
    return
  }
  try {
    await window.preload.fs.rm(item.path)
    MessageUtil.success('删除成功')
    selectedKeys.value = selectedKeys.value.filter((k) => k !== item.path)
    reload()
  } catch (e) {
    MessageUtil.error('删除失败', e)
  }
}

const handleBatchDelete = async (paths: string[]) => {
  if (paths.length === 0) return
  try {
    await MessageBoxUtil.confirm(
      `确认删除选中的 ${paths.length} 项？删除后不可恢复`,
      '批量删除'
    )
  } catch {
    return
  }
  try {
    await Promise.all(paths.map((p) => window.preload.fs.rm(p)))
    MessageUtil.success('删除成功')
    const set = new Set(paths)
    selectedKeys.value = selectedKeys.value.filter((k) => !set.has(k))
    reload()
  } catch (e) {
    MessageUtil.error('删除失败', e)
  }
}
</script>

<style scoped lang="less">
.asset-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;
}
</style>
