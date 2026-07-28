<template>
  <div class="plan-files">
    <div class="plan-files__toolbar">
      <t-button size="small" theme="primary" @click="handleUpload">
        <template #icon><UploadIcon /></template>
        上传文件
      </t-button>
      <t-button size="small" theme="default" variant="outline" @click="handleMkdir">
        <template #icon><FolderAddIcon /></template>
        新建文件夹
      </t-button>
      <t-tooltip content="刷新">
        <t-button
          size="small"
          theme="primary"
          variant="text"
          shape="square"
          @click="reload"
        >
          <template #icon><RefreshIcon /></template>
        </t-button>
      </t-tooltip>
    </div>

    <div v-if="loading" class="plan-files__loading">
      <t-loading size="small" text="加载中…" />
    </div>
    <div v-else-if="items.length === 0" class="plan-files__empty">
      <span>暂无附件，可上传文件或新建文件夹</span>
    </div>
    <ul v-else class="plan-files__list">
      <li v-for="it in items" :key="it.path" class="plan-files__item">
        <div class="plan-files__item-main">
          <component :is="iconOf(it)" class="plan-files__item-icon" />
          <span class="plan-files__item-name" :title="it.name">{{ it.name }}</span>
        </div>
        <div class="plan-files__item-actions">
          <t-link size="small" theme="primary" hover="color" @click="handleOpen(it)">
            打开
          </t-link>
          <t-link size="small" theme="primary" hover="color" @click="handleRename(it)">
            重命名
          </t-link>
          <t-link size="small" theme="danger" hover="color" @click="handleDelete(it)">
            删除
          </t-link>
        </div>
      </li>
    </ul>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref, watch } from 'vue'
import {
  FileCodeIcon,
  FileExcelIcon,
  FileIcon,
  FileImageIcon,
  FileMarkdownIcon,
  FileMusicIcon,
  FileWordIcon,
  FolderAddIcon,
  FolderIcon,
  RefreshIcon,
  UploadIcon,
  VideoIcon
} from 'tdesign-icons-vue-next'
import {
  buildProjectPlanFilesDir,
  projectPlanListFiles
} from '@/modules/project'
import { MessageBoxUtil, MessageUtil } from '@/utils/modal'
import { openAssetMkdirDialog } from '@/pages/project/asset/modals/AssetMkdirDialog'
import { openAssetRenameDialog } from '@/pages/project/asset/modals/AssetRenameDialog'

const props = defineProps<{ projectId: string; planId: string }>()

const items = ref<Array<FileItem>>([])
const loading = ref(false)

const filesDir = () => buildProjectPlanFilesDir(props.projectId, props.planId)

const reload = async () => {
  loading.value = true
  try {
    items.value = await projectPlanListFiles(props.projectId, props.planId)
  } catch (e) {
    MessageUtil.error('读取附件失败', e)
    items.value = []
  } finally {
    loading.value = false
  }
}

onMounted(reload)
watch(
  () => [props.projectId, props.planId],
  () => reload()
)

const splitName = (p: string) => p.split('/').pop() || p.split('\\').pop() || 'file'

/**
 * 目标目录下生成不冲突的最终路径：同名时追加 (n)
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

const handleUpload = async () => {
  const paths = window.preload.inject.dialog.open({
    title: '选择文件',
    properties: ['openFile', 'multiSelections']
  })
  if (!paths || paths.length === 0) return
  try {
    const target = filesDir()
    for (const p of paths) {
      const dest = uniquePath(target, splitName(p))
      await window.preload.fs.copyFile(p, dest)
    }
    MessageUtil.success(`已上传 ${paths.length} 个文件`)
    reload()
  } catch (e) {
    MessageUtil.error('上传失败', e)
  }
}

const handleMkdir = async () => {
  await openAssetMkdirDialog({ targetDir: filesDir() })
  reload()
}

const handleRename = async (item: FileItem) => {
  openAssetRenameDialog({ current: item })
  setTimeout(reload, 300)
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
    reload()
  } catch (e) {
    MessageUtil.error('删除失败', e)
  }
}

const handleOpen = (item: FileItem) => {
  if (item.isDirectory) return
  window.preload.inject.shell.openPath(item.path)
}

const getExt = (name: string) => {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

const CODE_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.vue', '.json', '.css', '.less', '.html',
  '.py', '.rs', '.go', '.java', '.c', '.cpp', '.h', '.hpp', '.yaml', '.yml',
  '.toml', '.xml', '.sh', '.bat', '.sql', '.rb', '.php', '.kt', '.dart',
  '.scss', '.lua', '.ini', '.gradle', '.tf', '.md'
])
const IMAGE_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp', '.avif'
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
</script>

<style scoped lang="less">
.plan-files {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__loading,
  &__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 64px;
    color: var(--td-text-color-placeholder);
    font: var(--td-font-body-small);
  }

  &__list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 220px;
    overflow-y: auto;
    border: 1px solid var(--fluent-border-subtle);
    border-radius: var(--td-radius-medium);
    background: var(--td-bg-color-container);
  }

  &__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 10px;

    &:hover {
      background: var(--td-bg-color-component);
    }

    &:not(:last-child) {
      border-bottom: 1px solid var(--fluent-border-subtle);
    }
  }

  &__item-main {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex: 1;
  }

  &__item-icon {
    flex-shrink: 0;
    color: var(--td-brand-color);
  }

  &__item-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--td-text-color-primary);
    font: var(--td-font-body-small);
  }

  &__item-actions {
    display: flex;
    gap: 10px;
    flex-shrink: 0;
  }
}
</style>
