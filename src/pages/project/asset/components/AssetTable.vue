<template>
  <div class="asset-table">
    <div v-if="loading" class="asset-table__loading">
      <t-loading text="加载中..." />
    </div>
    <t-enhanced-table
      v-else
      :data="displayList"
      :columns="columns"
      row-key="path"
      :selected-row-keys="selected"
      row-selection-type="multiple"
      hover
      size="small"
      table-layout="fixed"
      :row-class-name="rowClassName"
      @select-change="(keys: Array<string | number>) => handleSelectChange(keys as string[])"
      @row-dblclick="handleRowDblclick"
    >
      <template #empty>
        <t-empty title="暂无文件" description="点击上方「上传文件」或「新建文件夹」开始" />
      </template>
      <template #name="{ row }">
        <div class="asset-table__name" @click.stop="handleNameClick(row)">
          <component :is="iconOf(row)" class="asset-table__name-icon" />
          <span class="asset-table__name-text" :title="row.name">{{ row.name }}</span>
        </div>
      </template>
      <template #size="{ row }">
        {{ row.isDirectory ? '—' : prettyDataUnit(row.size) }}
      </template>
      <template #mtime="{ row }"> {{ toDateString(row.mtime) }} </template>
      <template #actions="{ row }">
        <div class="asset-table__actions">
          <t-link theme="primary" hover="color" @click="emit('rename', row)"> 重命名 </t-link>
          <t-link theme="danger" hover="color" @click="emit('delete', row)"> 删除 </t-link>
          <t-dropdown min-column-width="140px" trigger="click">
            <t-button variant="text" shape="square" size="small">
              <template #icon><more-icon /></template>
            </t-button>
            <t-dropdown-menu>
              <t-dropdown-item @click="openWith(row)"> 使用默认程序打开 </t-dropdown-item>
              <t-dropdown-item @click="showInFolder(row)"> 在文件夹中显示 </t-dropdown-item>
              <t-dropdown-item @click="copyToClipboard(row)"> 复制文件到剪贴板 </t-dropdown-item>
            </t-dropdown-menu>
          </t-dropdown>
        </div>
      </template>
    </t-enhanced-table>
  </div>
</template>

<script lang="ts" setup>
import { computed, inject } from 'vue'
import {
  FileCodeIcon,
  FileExcelIcon,
  FileIcon,
  FileImageIcon,
  FileMarkdownIcon,
  FileMusicIcon,
  FileWordIcon,
  FolderIcon,
  MoreIcon,
  VideoIcon
} from 'tdesign-icons-vue-next'
import { prettyDataUnit, toDateString } from '@/utils/lang/FormatUtil'
import { MessageUtil } from '@/utils/modal'
import { projectAssetContextKey } from '@/pages/project/detail/context/projectAssetContext'
import type { ProjectAssetTreeNode } from '@/modules/project'

interface SortOption {
  by: 'name' | 'size' | 'mtime'
  order: 'asc' | 'desc'
}

const props = defineProps<{
  rootDir: string
  currentDir: string
  keyword: string
  sort: SortOption
  selected: string[]
}>()

const emit = defineEmits<{
  'update:selected': [string[]]
  open: [FileItem]
  navigate: [path: string]
  rename: [FileItem]
  delete: [FileItem]
}>()

const assetContext = inject(projectAssetContextKey)
if (!assetContext) throw new Error('Project asset context is required')
const tree = assetContext.tree
const loading = assetContext.loading

const rowClassName = () => 'asset-table__row'

const findNodeByPath = (
  nodes: ProjectAssetTreeNode[],
  targetPath: string
): ProjectAssetTreeNode | null => {
  for (const node of nodes) {
    if (node.path === targetPath) return node
    if (node.children) {
      const found = findNodeByPath(node.children, targetPath)
      if (found) return found
    }
  }
  return null
}

const sortByName = (a: ProjectAssetTreeNode, b: ProjectAssetTreeNode) => a.name.localeCompare(b.name)
const sortBySize = (a: ProjectAssetTreeNode, b: ProjectAssetTreeNode) => a.size - b.size
const sortByMtime = (a: ProjectAssetTreeNode, b: ProjectAssetTreeNode) => a.mtime - b.mtime

const sortFlat = (nodes: ProjectAssetTreeNode[]): ProjectAssetTreeNode[] => {
  const cmp =
    props.sort.by === 'name' ? sortByName : props.sort.by === 'size' ? sortBySize : sortByMtime
  const dirFirst = (a: ProjectAssetTreeNode, b: ProjectAssetTreeNode) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return 0
  }
  return [...nodes].sort((a, b) => {
    const d = dirFirst(a, b)
    return d !== 0 ? d : props.sort.order === 'asc' ? cmp(a, b) : -cmp(a, b)
  })
}

const displayList = computed(() => {
  if (!tree.value || tree.value.length === 0) return []
  const children = props.currentDir === props.rootDir
    ? tree.value
    : (findNodeByPath(tree.value, props.currentDir)?.children ?? [])
  const kw = props.keyword.trim().toLowerCase()
  const filtered = kw ? children.filter(c => c.name.toLowerCase().includes(kw)) : children
  return sortFlat(filtered)
})

const handleSelectChange = (keys: string[]) => {
  emit('update:selected', keys)
}

const handleRowDblclick = (ctx: unknown) => {
  const row = getRowFileItem(ctx)
  if (!row) return
  if (row.isDirectory) {
    emit('navigate', row.path)
  } else {
    emit('open', row)
  }
}

const getRowFileItem = (ctx: unknown): FileItem | null => {
  if (!ctx || typeof ctx !== 'object' || !('row' in ctx)) return null
  const row = ctx.row
  return isFileItem(row) ? row : null
}

const isFileItem = (value: unknown): value is FileItem => {
  if (!value || typeof value !== 'object') return false
  return (
    'name' in value &&
    'path' in value &&
    'isDirectory' in value &&
    'isFile' in value &&
    typeof value.name === 'string' &&
    typeof value.path === 'string' &&
    typeof value.isDirectory === 'boolean' &&
    typeof value.isFile === 'boolean'
  )
}

const handleNameClick = (row: FileItem) => {
  if (row.isFile) emit('open', row)
}

const openWith = (row: FileItem) => window.preload.inject.shell.openPath(row.path)
const showInFolder = (row: FileItem) => window.preload.inject.shell.showItemInFolder(row.path)

const copyToClipboard = (row: FileItem) => {
  const ok = window.preload.inject.clipboard.copyFile(row.path)
  MessageUtil[ok ? 'success' : 'error'](ok ? '已复制到剪贴板' : '复制失败')
}

const getExt = (name: string) => {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

const CODE_EXTS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.vue',
  '.json',
  '.css',
  '.less',
  '.html',
  '.py',
  '.rs',
  '.go',
  '.java',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.yaml',
  '.yml',
  '.toml',
  '.xml',
  '.sh',
  '.bat',
  '.sql',
  '.rb',
  '.php',
  '.kt',
  '.dart',
  '.scss',
  '.lua',
  '.ini',
  '.gradle',
  '.tf'
])
const IMAGE_EXTS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.ico',
  '.bmp',
  '.avif'
])
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.avi', '.mov', '.mkv', '.wmv', '.flv'])
const AUDIO_EXTS = new Set(['.mp3', '.wav', '.ogg', '.flac', '.aac', '.wma', '.m4a', '.opus'])

const iconOf = (item: FileItem) => {
  if (item.isDirectory) return FolderIcon
  const ext = getExt(item.name)
  if (IMAGE_EXTS.has(ext)) return FileImageIcon
  if (VIDEO_EXTS.has(ext)) return VideoIcon
  if (AUDIO_EXTS.has(ext)) return FileMusicIcon
  if (ext === '.xls' || ext === '.xlsx') return FileExcelIcon
  if (ext === '.doc' || ext === '.docx') return FileWordIcon
  if (ext === '.md') return FileMarkdownIcon
  if (CODE_EXTS.has(ext)) return FileCodeIcon
  return FileIcon
}

const columns = computed(() => [
  { colKey: 'name', title: '名称', minWidth: 320 },
  { colKey: 'size', title: '大小', width: 120, align: 'right' as const },
  { colKey: 'mtime', title: '修改时间', width: 180 },
  { colKey: 'actions', title: '操作', width: 200, align: 'right' as const }
])
</script>

<style scoped lang="less">
.asset-table {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-medium);
  overflow: hidden;

  &__loading {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  :deep(.asset-table__row) {
    cursor: pointer;
  }

  :deep(.asset-table__name) {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    cursor: pointer;
  }

  :deep(.asset-table__name-icon) {
    flex-shrink: 0;
    color: var(--td-brand-color);
  }

  :deep(.asset-table__name-text) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--td-text-color-primary);
  }

  :deep(.asset-table__actions) {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
  }
}
</style>
