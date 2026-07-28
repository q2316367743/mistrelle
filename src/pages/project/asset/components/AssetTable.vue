<template>
  <div class="asset-table">
    <div v-if="loading" class="asset-table__loading">
      <t-loading text="加载中..." />
    </div>
    <t-enhanced-table
      v-else
      :data="displayTree"
      :columns="columns"
      row-key="path"
      :selected-row-keys="selected"
      row-selection-type="multiple"
      :tree="{ childrenKey: 'children', indent: 20, defaultExpandAll: true }"
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
import { computed, ref, watch } from 'vue'
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
import { buildProjectAssetDirPath } from '@/modules/project'
import { prettyDataUnit, toDateString } from '@/utils/lang/FormatUtil'
import { MessageUtil } from '@/utils/modal'

interface SortOption {
  by: 'name' | 'size' | 'mtime'
  order: 'asc' | 'desc'
}

type AssetTreeNode = FileItem & { children?: AssetTreeNode[] }

const props = defineProps<{
  id: string
  keyword: string
  sort: SortOption
  reloadKey: number
  selected: string[]
}>()

const emit = defineEmits<{
  'update:selected': [string[]]
  open: [FileItem]
  rename: [FileItem]
  delete: [FileItem]
  'filtered-count': [number]
}>()

const tree = ref<AssetTreeNode[]>([])
const loading = ref(false)

/**
 * 递归读取目录构建资产树（一次拉全量；个人项目量级可控）
 */
const readTree = async (dir: string): Promise<AssetTreeNode[]> => {
  const items = await window.preload.fs.readDir(dir)
  const result: AssetTreeNode[] = []
  for (const item of items) {
    if (item.name.startsWith('.')) continue
    if (item.isDirectory) {
      const children = await readTree(item.path)
      result.push({ ...item, children })
    } else {
      result.push({ ...item, children: undefined })
    }
  }
  return result
}

const load = async () => {
  loading.value = true
  try {
    const dir = buildProjectAssetDirPath(props.id)
    if (!window.preload.fs.existsSync(dir)) {
      await window.preload.fs.mkdir(dir)
    }
    tree.value = await readTree(dir)
  } catch (e) {
    MessageUtil.error('读取资产失败', e)
    tree.value = []
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.id, props.reloadKey],
  () => {
    load()
  },
  { immediate: true }
)

const rowClassName = ({ row }: { row: AssetTreeNode }) =>
  row.isDirectory ? 'asset-table__row asset-table__row--dir' : 'asset-table__row'

const sortByName = (a: AssetTreeNode, b: AssetTreeNode) => a.name.localeCompare(b.name)
const sortBySize = (a: AssetTreeNode, b: AssetTreeNode) => a.size - b.size
const sortByMtime = (a: AssetTreeNode, b: AssetTreeNode) => a.mtime - b.mtime

const sortNodes = (nodes: AssetTreeNode[]): AssetTreeNode[] => {
  const cmp =
    props.sort.by === 'name' ? sortByName : props.sort.by === 'size' ? sortBySize : sortByMtime
  const dirFirst = (a: AssetTreeNode, b: AssetTreeNode) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return 0
  }
  const sorted = [...nodes].sort((a, b) => {
    const d = dirFirst(a, b)
    return d !== 0 ? d : props.sort.order === 'asc' ? cmp(a, b) : -cmp(a, b)
  })
  return sorted.map((n) =>
    n.isDirectory && n.children ? { ...n, children: sortNodes(n.children) } : n
  )
}

const filterTree = (nodes: AssetTreeNode[], kw: string): AssetTreeNode[] => {
  if (!kw) return nodes
  const result: AssetTreeNode[] = []
  for (const node of nodes) {
    if (node.isFile) {
      if (node.name.toLowerCase().includes(kw)) result.push(node)
    } else {
      const children = node.children ? filterTree(node.children, kw) : []
      if (node.name.toLowerCase().includes(kw) || children.length > 0) {
        result.push({ ...node, children })
      }
    }
  }
  return result
}

const countTree = (nodes: AssetTreeNode[]): number =>
  nodes.reduce((acc, n) => acc + 1 + (n.children ? countTree(n.children) : 0), 0)

const displayTree = computed(() => {
  const kw = props.keyword.trim().toLowerCase()
  const filtered = filterTree(tree.value, kw)
  return sortNodes(filtered)
})

watch(
  displayTree,
  (nodes) => {
    emit('filtered-count', countTree(nodes))
  },
  { immediate: true }
)

const handleSelectChange = (keys: string[]) => {
  emit('update:selected', keys)
}

const handleRowDblclick = (ctx: any) => {
  const row = ctx.row as FileItem
  if (row.isFile) emit('open', row)
}

/**
 * 点击名称：目录行由 t-enhanced-table 处理展开；文件行触发打开
 */
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
