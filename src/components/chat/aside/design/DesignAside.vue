<template>
  <div class="design-aside">
    <div class="design-aside__toolbar">
      <t-select
        v-model="selected"
        class="design-aside__select"
        :options="canvasOptions"
        clearable
        placeholder="选择画布"
        :empty="emptyText"
        @change="handleSelect"
      />
      <t-button
        theme="primary"
        variant="text"
        shape="square"
        title="新建画布"
        :loading="creating"
        @click="handleCreate"
      >
        <template #icon>
          <add-icon />
        </template>
      </t-button>
      <t-button theme="primary" variant="text" shape="square" title="刷新" @click="handleRefresh">
        <template #icon>
          <refresh-icon />
        </template>
      </t-button>
      <t-dropdown
        trigger="click"
        :disabled="!store.current.value || busy"
        min-column-width="150px"
        placement="bottom-right"
        @click="handleAction"
      >
        <t-button theme="primary" variant="text" shape="square" title="更多操作">
          <template #icon>
            <more-icon />
          </template>
        </t-button>
        <t-dropdown-menu>
          <t-dropdown-item value="folder">
            <template #prefix-icon>
              <folder-open-icon />
            </template>
            文件夹中显示
          </t-dropdown-item>
          <t-dropdown-item value="copy">
            <template #prefix-icon>
              <copy-icon />
            </template>
            复制图片
          </t-dropdown-item>
          <t-dropdown-item value="download">
            <template #prefix-icon>
              <download-icon />
            </template>
            下载图片
          </t-dropdown-item>
          <t-dropdown-item v-if="hasAnimation" value="video">
            <template #prefix-icon>
              <video-icon />
            </template>
            导出为视频
          </t-dropdown-item>
        </t-dropdown-menu>
      </t-dropdown>
    </div>
    <div class="design-aside__body" :class="{ 'design-aside__body--split': fullscreen }">
      <canvas-element-tree
        v-if="fullscreen"
        :nodes="store.current.value?.nodes ?? []"
        :selected-id="selectedId"
        @select="handleElementSelect"
      />
      <canvas-renderer
        :sandbox="sandbox"
        :selected-id="selectedId"
        class="design-aside__canvas"
        @select="handleElementSelect"
      />
    </div>
  </div>
</template>
<script lang="ts" setup>
import dayjs from 'dayjs'
import { MessageUtil } from '@/utils/modal'
import { blobToBase64 } from '@/utils/file/CovertUtil'
import {
  AddIcon,
  CopyIcon,
  DownloadIcon,
  FolderOpenIcon,
  MoreIcon,
  RefreshIcon,
  VideoIcon
} from 'tdesign-icons-vue-next'
import type { DropdownProps } from 'tdesign-vue-next'
import {
  buildCanvasFileName,
  buildCanvasOutputsDir,
  exportCanvasPng,
  getCanvasStore,
  maxAnimationTime
} from '@/modules/canvas'
import CanvasRenderer from './CanvasRenderer.vue'
import CanvasElementTree from './CanvasElementTree.vue'
import { openVideoExportDialog } from './VideoExportDialog'

const props = defineProps<{
  sandbox?: string
  /** 侧边栏全屏：展示「左元素树 + 右画布」双栏布局 */
  fullscreen?: boolean
}>()

const store = computed(() => getCanvasStore(props.sandbox ?? ''))

const selected = ref<number | undefined>(undefined)
const creating = ref(false)
const busy = ref(false)
/** 画布选中节点 id（元素树 ↔ 画布双向联动的唯一数据源） */
const selectedId = ref<string | undefined>(undefined)

const handleElementSelect = (id: string | undefined) => {
  selectedId.value = id
}

const canvasOptions = computed(() =>
  store.value.files.value.map((file) => ({
    label: file.title ? `${file.title}（${file.name}）` : file.name,
    value: file.version
  }))
)

/** 当前画布是否存在动画（决定是否显示「导出为视频」入口） */
const hasAnimation = computed(() => {
  const doc = store.value.current.value
  return doc ? maxAnimationTime(doc) > 0 : false
})

const emptyText = '请先让 AI 创建画布'

/** 文件列表刷新后，若当前已有打开的画布则保持选中态 */
const syncSelected = () => {
  selected.value = store.value.current.value?.version
}

onMounted(async () => {
  await store.value.refreshFiles()
  const files = store.value.files.value
  // 默认打开最新（最后一个）版本的设计图
  if (files.length && !store.value.current.value) {
    await store.value.open(files[files.length - 1].version)
  }
  syncSelected()
})

watch(
  () => store.value.files.value,
  () => syncSelected(),
  { deep: true }
)

// AI 通过 canvas_create / canvas_open 变更当前画布 → 同步下拉选中
watch(
  () => store.value.current.value?.version,
  (version) => {
    selected.value = version
  }
)

const handleSelect = (version: unknown) => {
  const v = typeof version === 'number' ? version : undefined
  if (v == null) return
  if (store.value.current.value?.version === v) return
  void store.value.open(v)
}

const handleCreate = async () => {
  if (creating.value) return
  creating.value = true
  try {
    await store.value.create({
      title: '',
      width: 800,
      height: 600,
      background: '#ffffff'
    })
  } finally {
    creating.value = false
  }
}

const handleRefresh = () => {
  void store.value.refreshFiles()
}

/** 复制当前画布为图片到剪贴板 */
const handleCopy = async () => {
  const doc = store.value.current.value
  if (!doc) return
  busy.value = true
  try {
    const blob = await exportCanvasPng(doc)
    const dataUrl = await blobToBase64(blob)
    if (window.preload.inject.clipboard.copyImage(dataUrl)) {
      MessageUtil.success('已复制到剪贴板')
    } else {
      MessageUtil.error('复制失败')
    }
  } catch (e) {
    MessageUtil.error('复制失败', e)
  } finally {
    busy.value = false
  }
}

/** 下载当前画布为图片（选择保存路径，文件名 title+时间戳） */
const handleDownload = async () => {
  const doc = store.value.current.value
  if (!doc) return
  busy.value = true
  try {
    const blob = await exportCanvasPng(doc)
    const name = `${doc.title || doc.name || 'canvas'}-${dayjs().format('YYYYMMDDHHmmss')}.png`
    const path = window.preload.inject.dialog.save({
      title: '保存画布图片',
      defaultPath: name,
      filters: [{ name: 'PNG 图片', extensions: ['png'] }]
    })
    if (!path) return
    await window.preload.fs.writeBinaryFile(path, await blob.arrayBuffer())
    MessageUtil.success('已保存画布图片')
  } catch (e) {
    MessageUtil.error('保存失败', e)
  } finally {
    busy.value = false
  }
}

const handleAction: DropdownProps['onClick'] = (data) => {
  if (data.value === 'copy') void handleCopy()
  else if (data.value === 'download') void handleDownload()
  else if (data.value === 'video') openVideoExportDialog({ sandbox: props.sandbox ?? '' })
  else if (data.value === 'folder') {
    if (selected.value) {
      window.preload.inject.shell.showItemInFolder(
        window.preload.path.join(
          buildCanvasOutputsDir(props.sandbox ?? ''),
          buildCanvasFileName(selected.value)
        )
      )
    } else {
      window.preload.inject.shell.openPath(buildCanvasOutputsDir(props.sandbox ?? ''))
    }
  }
}
</script>
<style scoped lang="less">
.design-aside {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 8px 0 8px 8px;

  &__toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__select {
    flex: 1;
    min-width: 0;
  }

  &__body {
    flex: 1;
    min-height: 0;
    margin-top: 8px;
    display: flex;

    &--split {
      gap: 8px;
    }
  }

  &__canvas {
    flex: 1;
    min-width: 0;
  }
}
</style>
