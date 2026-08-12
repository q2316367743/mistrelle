<template>
  <div class="ppt-aside">
    <div :class="['ppt-aside__toolbar', { fullscreen: fullscreen }]">
      <t-select
        v-model="selected"
        class="ppt-aside__select"
        :options="slideOptions"
        clearable
        placeholder="选择 PPT"
        :empty="emptyText"
        :disabled="isChatRunning"
        @change="handleSelect"
      />
      <t-button theme="primary" variant="text" shape="square" title="刷新" @click="handleRefresh">
        <template #icon>
          <refresh-icon />
        </template>
      </t-button>
      <t-dropdown
        trigger="click"
        min-column-width="150px"
        placement="bottom-right"
        @click="handleAction"
      >
        <t-button
          theme="primary"
          variant="text"
          shape="square"
          title="更多操作"
          :disabled="!store.current.value || busy"
        >
          <template #icon>
            <more-icon />
          </template>
        </t-button>
        <t-dropdown-menu>
          <t-dropdown-item value="export-pptx">
            <template #prefix-icon>
              <file-icon />
            </template>
            导出 PPTX
          </t-dropdown-item>
          <t-dropdown-item value="export-png">
            <template #prefix-icon>
              <image-icon />
            </template>
            导出当前页 PNG
          </t-dropdown-item>
          <t-dropdown-item value="folder">
            <template #prefix-icon>
              <folder-open-icon />
            </template>
            文件夹中显示
          </t-dropdown-item>
        </t-dropdown-menu>
      </t-dropdown>
    </div>
    <ppt-renderer class="ppt-aside__renderer" :sandbox="sandbox" />
  </div>
</template>
<script lang="ts" setup>
import dayjs from 'dayjs'
import { MessageUtil } from '@/utils/modal'
import { FolderOpenIcon, FileIcon, ImageIcon, MoreIcon, RefreshIcon } from 'tdesign-icons-vue-next'
import type { DropdownProps } from 'tdesign-vue-next'
import {
  buildPptxBytes,
  buildPptOutputsDir,
  buildSlidesFileName,
  getPptStore,
  renderPptxToPngs
} from '@/modules/ppt'
import { PPT_SLIDE_SIZE } from '@/modules/ppt'
import type { ChatStatus } from '@/modules/chat'
import PptRenderer from './PptRenderer.vue'

const props = withDefaults(
  defineProps<{
    sandbox?: string
    fullscreen?: boolean
    /** 会话作答状态：pending / streaming 视为聊天进行中 */
    status?: ChatStatus
  }>(),
  {
    sandbox: '',
    fullscreen: false,
    status: 'idle'
  }
)

const store = computed(() => getPptStore(props.sandbox ?? ''))

const selected = ref<number | undefined>(undefined)
const busy = ref(false)

/** 聊天进行中（pending / streaming）：禁用手动切换 PPT，避免干扰 AI 作答 */
const isChatRunning = computed(() => props.status === 'pending' || props.status === 'streaming')

const emptyText = '请先让 AI 创建 PPT'

const slideOptions = computed(() =>
  store.value.files.value.map((file) => ({
    label: `版本 ${file.version}（${dayjs(file.updatedTime).format('MM-DD HH:mm')}）`,
    value: file.version
  }))
)

/** 文件列表刷新后，若当前已有打开的 PPT 则保持选中态 */
const syncSelected = () => {
  selected.value = store.value.current.value?.version
}

onMounted(async () => {
  await store.value.refreshFiles()
  const files = store.value.files.value
  // 默认打开最新版本
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

// AI 通过 ppt_create / ppt_open / ppt_batch_edit 变更当前 PPT → 同步下拉选中
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

const handleRefresh = () => {
  void store.value.refreshFiles()
}

/** 导出当前 PPTX（用户选择保存路径） */
const handleExportPptx = async () => {
  const doc = store.value.current.value
  if (!doc) return
  busy.value = true
  try {
    const bytes = await buildPptxBytes(doc.xml, PPT_SLIDE_SIZE)
    const name = `slides-${doc.version}-${dayjs().format('YYYYMMDDHHmmss')}.pptx`
    const path = await window.preload.inject.dialog.save({
      title: '导出 PPTX',
      defaultPath: name,
      filters: [{ name: 'PPTX 演示文稿', extensions: ['pptx'] }]
    })
    if (!path) return
    await window.preload.fs.writeBinaryFile(path, bytes)
    MessageUtil.success('已导出 PPTX')
  } catch (e) {
    MessageUtil.error('导出失败', e)
  } finally {
    busy.value = false
  }
}

/** 导出当前页 PNG（用户选择保存路径） */
const handleExportPng = async () => {
  const doc = store.value.current.value
  if (!doc) return
  busy.value = true
  try {
    const page = store.value.currentPage.value
    const results = await renderPptxToPngs(doc.xml, PPT_SLIDE_SIZE, [page])
    const result = results[0]
    if (!result) throw new Error('当前页渲染失败')
    const name = `slides-${doc.version}-page-${result.page}-${dayjs().format('YYYYMMDDHHmmss')}.png`
    const path = await window.preload.inject.dialog.save({
      title: '导出当前页 PNG',
      defaultPath: name,
      filters: [{ name: 'PNG 图片', extensions: ['png'] }]
    })
    if (!path) return
    await window.preload.fs.writeBinaryFile(path, result.bytes)
    MessageUtil.success('已导出 PNG')
  } catch (e) {
    MessageUtil.error('导出失败', e)
  } finally {
    busy.value = false
  }
}

const handleAction: DropdownProps['onClick'] = (data) => {
  if (data.value === 'export-pptx') void handleExportPptx()
  else if (data.value === 'export-png') void handleExportPng()
  else if (data.value === 'folder') {
    if (selected.value) {
      window.preload.inject.shell.showItemInFolder(
        window.preload.path.join(
          buildPptOutputsDir(props.sandbox ?? ''),
          buildSlidesFileName(selected.value)
        )
      )
    } else {
      void window.preload.inject.shell.openPath(buildPptOutputsDir(props.sandbox ?? ''))
    }
  }
}
</script>
<style scoped lang="less">
.ppt-aside {
  height: calc(100% - 16px);
  display: flex;
  flex-direction: column;
  padding: 8px 0 8px 8px;

  &__toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    &.fullscreen {
      padding-right: 8px;
    }
  }

  &__select {
    flex: 1;
    min-width: 0;
  }

  &__renderer {
    margin-top: 8px;
  }
}
</style>
