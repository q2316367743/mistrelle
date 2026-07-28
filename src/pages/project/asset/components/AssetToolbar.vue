<template>
  <div class="asset-toolbar">
    <div class="asset-toolbar__row">
      <div class="asset-toolbar__left">
        <t-button theme="primary" @click="handleUploadFile">
          <template #icon><UploadIcon /></template>
          上传文件
        </t-button>
        <t-button theme="default" variant="outline" @click="handleUploadDir">
          <template #icon><FolderAddIcon /></template>
          上传文件夹
        </t-button>
        <t-button theme="default" variant="outline" @click="handleMkdir">
          <template #icon><AddIcon /></template>
          新建文件夹
        </t-button>
      </div>

      <div class="asset-toolbar__right">
        <t-input
          :value="keyword"
          clearable
          placeholder="搜索文件名"
          class="asset-toolbar__search"
          @change="(v) => emit('search', String(v ?? ''))"
          @clear="() => emit('search', '')"
        >
          <template #prefix-icon><SearchIcon /></template>
        </t-input>
        <t-select
          :value="sortValue"
          class="asset-toolbar__sort"
          @change="(v) => handleSortChange(String(v))"
        >
          <t-option value="name-asc" label="名称 ↑"></t-option>
          <t-option value="name-desc" label="名称 ↓"></t-option>
          <t-option value="size-desc" label="大小 ↓"></t-option>
          <t-option value="size-asc" label="大小 ↑"></t-option>
          <t-option value="mtime-desc" label="修改时间 ↓"></t-option>
          <t-option value="mtime-asc" label="修改时间 ↑"></t-option>
        </t-select>
        <t-tooltip v-if="selected.length > 0" :content="`已选 ${selected.length} 项`">
          <t-button theme="danger" variant="outline" @click="emit('batch-delete', selected)">
            <template #icon><DeleteIcon /></template>
            删除 ({{ selected.length }})
          </t-button>
        </t-tooltip>
        <t-tooltip content="刷新">
          <t-button theme="primary" variant="text" shape="square" @click="emit('refresh')">
            <template #icon><RefreshIcon /></template>
          </t-button>
        </t-tooltip>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import {
  AddIcon,
  DeleteIcon,
  FolderAddIcon,
  RefreshIcon,
  SearchIcon,
  UploadIcon
} from 'tdesign-icons-vue-next'
import { buildProjectAssetDirPath } from '@/modules/project'
import { MessageUtil } from '@/utils/modal'
import { openAssetMkdirDialog } from '../modals/AssetMkdirDialog'

interface SortOption {
  by: 'name' | 'size' | 'mtime'
  order: 'asc' | 'desc'
}

const props = defineProps<{
  id: string
  selected: string[]
  keyword: string
  sort: SortOption
}>()

const emit = defineEmits<{
  search: [string]
  'sort-change': [SortOption]
  uploaded: []
  refresh: []
  'batch-delete': [string[]]
}>()

const sortValue = computed(() => `${props.sort.by}-${props.sort.order}`)

const handleSortChange = (v: string) => {
  const [by, order] = v.split('-') as [SortOption['by'], SortOption['order']]
  emit('sort-change', { by, order })
}

const rootDir = computed(() => buildProjectAssetDirPath(props.id))

const splitName = (p: string) => p.split('/').pop() || p.split('\\').pop() || 'file'

/**
 * 在目标目录下生成不冲突的最终路径：同名时追加 (n)
 */
const uniquePath = (baseDir: string, name: string): string => {
  let dest = window.preload.path.join(baseDir, name)
  if (!window.preload.fs.existsSync(dest)) return dest
  const extIdx = name.lastIndexOf('.')
  const stem = extIdx > 0 ? name.slice(0, extIdx) : name
  const ext = extIdx > 0 ? name.slice(extIdx) : ''
  let i = 1
  while (window.preload.fs.existsSync(dest)) {
    dest = window.preload.path.join(baseDir, `${stem} (${i})${ext}`)
    i++
  }
  return dest
}

const copyDirRecursive = async (srcDir: string, targetDir: string) => {
  const items = await window.preload.fs.readDir(srcDir)
  for (const item of items) {
    if (item.isDirectory) {
      const subDir = uniquePath(targetDir, item.name)
      await window.preload.fs.mkdir(subDir)
      await copyDirRecursive(item.path, subDir)
    } else if (item.isFile) {
      const dest = uniquePath(targetDir, item.name)
      await window.preload.fs.copyFile(item.path, dest)
    }
  }
}

const handleUploadFile = async () => {
  const paths = window.preload.inject.dialog.open({
    title: '选择文件',
    properties: ['openFile', 'multiSelections']
  })
  if (!paths || paths.length === 0) return
  try {
    const target = rootDir.value
    for (const p of paths) {
      const dest = uniquePath(target, splitName(p))
      await window.preload.fs.copyFile(p, dest)
    }
    MessageUtil.success(`已上传 ${paths.length} 个文件`)
    emit('uploaded')
  } catch (e) {
    MessageUtil.error('上传失败', e)
  }
}

const handleUploadDir = async () => {
  const paths = window.preload.inject.dialog.open({
    title: '选择文件夹',
    properties: ['openDirectory']
  })
  if (!paths || paths.length === 0) return
  try {
    const target = rootDir.value
    for (const p of paths) {
      const destDir = uniquePath(target, splitName(p))
      await window.preload.fs.mkdir(destDir)
      await copyDirRecursive(p, destDir)
    }
    MessageUtil.success('上传完成')
    emit('uploaded')
  } catch (e) {
    MessageUtil.error('上传失败', e)
  }
}

const handleMkdir = async () => {
  await openAssetMkdirDialog({ targetDir: rootDir.value })
  emit('uploaded')
}
</script>

<style scoped lang="less">
.asset-toolbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-medium);
  flex-shrink: 0;

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  &__left,
  &__right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__search {
    width: 220px;
  }

  &__sort {
    width: 160px;
  }
}
</style>
