<template>
  <div class="design-aside">
    <div class="design-aside__toolbar">
      <canvas-file-picker :sandbox="sandbox" :disabled="isChatRunning" />
      <t-button theme="primary" variant="text" shape="square" title="刷新" @click="handleRefresh">
        <template #icon>
          <refresh-icon />
        </template>
      </t-button>
      <mosaic-entry-button :reason="mosaicReason" @open="handleMosaicOpen" />
      <t-dropdown
        trigger="click"
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
          <t-dropdown-item value="copy" :disabled="!store.current.value || busy">
            <template #prefix-icon>
              <copy-icon />
            </template>
            复制图片
          </t-dropdown-item>
          <t-dropdown-item value="download-png" :disabled="!store.current.value || busy">
            <template #prefix-icon>
              <download-icon />
            </template>
            下载图片
          </t-dropdown-item>
          <t-dropdown-item value="download-psd" :disabled="!store.current.value || busy">
            <template #prefix-icon>
              <download-icon />
            </template>
            下载 PSD
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
      <!-- key 随 fullscreen 变化强制重建：leafer App 的 editor 交互配置（moveable 等）在构造时固定，
           仅改 prop 不会生效 -->
      <canvas-renderer
        :key="fullscreen ? 'edit' : 'view'"
        :sandbox="sandbox"
        :selected-id="selectedId"
        :editable="fullscreen"
        class="design-aside__canvas"
        @select="handleElementSelect"
      />
      <element-property-panel
        v-if="fullscreen"
        :sandbox="sandbox ?? ''"
        :node-id="selectedId"
        @deleted="selectedId = undefined"
      />
    </div>
  </div>
</template>
<script lang="ts" setup>
import dayjs from 'dayjs'
import { MessageUtil } from '@/utils/modal'
import { blobToBase64 } from '@/utils/file/CovertUtil'
import {
  CopyIcon,
  DownloadIcon,
  FolderOpenIcon,
  MoreIcon,
  RefreshIcon
} from 'tdesign-icons-vue-next'
import type { DropdownProps } from 'tdesign-vue-next'
import {
  buildCanvasFileName,
  buildCanvasOutputsDir,
  exportCanvasPng,
  exportCanvasPsd,
  getCanvasStore
} from '@/windows/main/modules/canvas'
import type { ChatStatus } from '@/windows/main/modules/chat'
import CanvasRenderer from './CanvasRenderer.vue'
import CanvasElementTree from './CanvasElementTree.vue'
import ElementPropertyPanel from './ElementPropertyPanel.vue'
import CanvasFilePicker from './components/CanvasFilePicker.vue'
import MosaicEntryButton from './components/MosaicEntryButton.vue'
import { useMosaicTarget } from './useMosaicTarget'
import { openMosaicDialog } from './modals/MosaicDialog'

const props = withDefaults(
  defineProps<{
    sandbox?: string
    /** 用户工作空间：已选择时「文件夹中显示」优先打开它 */
    workspace?: string
    /** 侧边栏全屏：展示「左元素树 + 右画布」双栏布局 */
    fullscreen?: boolean
    /** 会话作答状态：pending / streaming 视为聊天进行中 */
    status?: ChatStatus
  }>(),
  {
    sandbox: '',
    workspace: '',
    fullscreen: false,
    status: 'idle'
  }
)

const store = computed(() => getCanvasStore(props.sandbox ?? ''))

const busy = ref(false)
/** 画布选中节点 id（元素树 ↔ 画布双向联动的唯一数据源） */
const selectedId = ref<string | undefined>(undefined)

/** 聊天进行中（pending / streaming）：禁用手动切换画布，避免干扰 AI 作答 */
const isChatRunning = computed(() => props.status === 'pending' || props.status === 'streaming')

const handleElementSelect = (id: string | undefined) => {
  selectedId.value = id
}

// ── 图片遮盖（工具栏入口：优先选中图片节点，未选中时退回画布唯一图片）──
const { target: mosaicTarget, reason: mosaicReason } = useMosaicTarget(
  () => props.sandbox ?? '',
  () => selectedId.value
)

const handleMosaicOpen = () => {
  const target = mosaicTarget.value
  if (!target) return
  openMosaicDialog({
    sandbox: props.sandbox ?? '',
    nodeId: target.nodeId,
    source: target.source,
    initial: target.mosaic
  })
}

onMounted(async () => {
  await store.value.refreshFiles()
  const files = store.value.files.value
  // 默认打开最新（最后一个）版本的设计图
  if (files.length && !store.value.current.value) {
    await store.value.open(files[files.length - 1].version)
  }
})

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
    const ok = await window.preload.inject.clipboard.copyImage(dataUrl)
    if (ok) {
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

/** 下载当前画布（选择保存路径，文件名 title+时间戳；png 整图 / psd 分层位图） */
const handleDownload = async (format: 'png' | 'psd') => {
  const doc = store.value.current.value
  if (!doc) return
  busy.value = true
  try {
    const ext = format === 'psd' ? 'psd' : 'png'
    const name = `${doc.title || doc.name || 'canvas'}-${dayjs().format('YYYYMMDDHHmmss')}.${ext}`
    const path = await window.preload.inject.dialog.save({
      title: '保存画布图片',
      defaultPath: name,
      filters:
        format === 'psd'
          ? [{ name: 'Photoshop 文件', extensions: ['psd'] }]
          : [{ name: 'PNG 图片', extensions: ['png'] }]
    })
    if (!path) return
    const data =
      format === 'psd' ? await exportCanvasPsd(doc) : await (await exportCanvasPng(doc)).arrayBuffer()
    await window.preload.fs.writeBinaryFile(path, data)
    MessageUtil.success(format === 'psd' ? '已保存分层 PSD' : '已保存画布图片')
  } catch (e) {
    MessageUtil.error('保存失败', e)
  } finally {
    busy.value = false
  }
}

const handleAction: DropdownProps['onClick'] = (data) => {
  if (data.value === 'copy') void handleCopy()
  else if (data.value === 'download-png') void handleDownload('png')
  else if (data.value === 'download-psd') void handleDownload('psd')
  else if (data.value === 'folder') {
    const version = store.value.current.value?.version
    if (version) {
      window.preload.inject.shell.showItemInFolder(
        window.preload.path.join(buildCanvasOutputsDir(props.sandbox ?? ''), buildCanvasFileName(version))
      )
    } else {
      window.preload.inject.shell.openPath(
        props.workspace || buildCanvasOutputsDir(props.sandbox ?? '')
      )
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

  &__body {
    flex: 1;
    min-height: 0;
    margin-top: 8px;
    display: flex;

    &--split {
      margin-bottom: 8px;
      gap: 8px;
    }
  }

  &__canvas {
    flex: 1;
    min-width: 0;
  }
}
</style>
