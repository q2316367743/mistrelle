<template>
  <div class="asset-page">
    <asset-toolbar
      :current-dir="currentDir"
      :selected="selectedKeys"
      :keyword="keyword"
      :sort="sort"
      @search="(v) => (keyword = v)"
      @sort-change="(v) => (sort = v)"
      @uploaded="reload"
      @refresh="reload"
      @batch-delete="handleBatchDelete"
    />
    <div class="asset-nav">
      <t-button variant="text" shape="square" :disabled="!canGoBack" @click="handleGoBack">
        <template #icon><ChevronLeftIcon /></template>
      </t-button>
      <template v-for="(crumb, i) in breadcrumbs" :key="crumb.path">
        <t-link v-if="i < breadcrumbs.length - 1" theme="primary" @click="handleBreadcrumbClick(crumb.path)">
          {{ crumb.label }}
        </t-link>
        <span v-else class="asset-nav__current">{{ crumb.label }}</span>
        <span v-if="i < breadcrumbs.length - 1" class="asset-nav__sep">/</span>
      </template>
    </div>
    <asset-table
      :root-dir="rootDir"
      :current-dir="currentDir"
      :keyword="keyword"
      :sort="sort"
      v-model:selected="selectedKeys"
      @open="openItem"
      @navigate="handleNavigate"
      @rename="handleRename"
      @delete="handleDelete"
    />
  </div>
</template>

<script lang="ts" setup>
import { computed, inject, ref } from 'vue'
import { ChevronLeftIcon } from 'tdesign-icons-vue-next'
import AssetToolbar from './components/AssetToolbar.vue'
import AssetTable from './components/AssetTable.vue'
import { buildProjectAssetDirPath } from '@/modules/project'
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

const rootDir = computed(() => buildProjectAssetDirPath(props.id))
const currentDir = ref(rootDir.value)

const breadcrumbs = computed(() => {
  const root = rootDir.value
  if (currentDir.value === root) return [{ label: '根目录', path: root }]
  const rel = currentDir.value.slice(root.length).replace(/^\//, '').split('/')
  const crumbs = [{ label: '根目录', path: root }]
  let acc = root
  for (const seg of rel) {
    acc = window.preload.path.join(acc, seg)
    crumbs.push({ label: seg, path: acc })
  }
  return crumbs
})

const canGoBack = computed(() => currentDir.value !== rootDir.value)

const handleNavigate = (dir: string) => {
  if (currentDir.value === dir) return
  selectedKeys.value = []
  currentDir.value = dir
}

const handleGoBack = () => {
  const parent = window.preload.path.dirname(currentDir.value)
  if (parent && parent.startsWith(rootDir.value)) {
    currentDir.value = parent
  } else {
    currentDir.value = rootDir.value
  }
}

const handleBreadcrumbClick = (path: string) => {
  if (currentDir.value === path) return
  selectedKeys.value = []
  currentDir.value = path
}

const reload = () => {
  assetContext.refresh()
    .then(() => {
      if (!window.preload.fs.existsSync(currentDir.value)) {
        currentDir.value = rootDir.value
      }
    })
    .catch((e) => MessageUtil.error('刷新资产失败', e))
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

.asset-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 12px;
  min-height: 32px;
  flex-shrink: 0;

  &__sep {
    color: var(--td-text-color-placeholder);
    margin: 0 2px;
  }

  &__current {
    color: var(--td-text-color-primary);
    font-size: 14px;
  }
}
</style>
