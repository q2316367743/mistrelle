<template>
  <div class="html-design-aside">
    <div class="html-design-aside__toolbar">
      <t-select
        v-model="selected"
        class="html-design-aside__select"
        :options="docOptions"
        clearable
        placeholder="选择设计稿"
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
          <t-dropdown-item value="copy" :disabled="!current || busy">
            <template #prefix-icon>
              <copy-icon />
            </template>
            复制图片
          </t-dropdown-item>
          <t-dropdown-item value="download" :disabled="!current || busy">
            <template #prefix-icon>
              <download-icon />
            </template>
            下载图片
          </t-dropdown-item>
          <t-dropdown-item value="source" :disabled="!current">
            <template #prefix-icon>
              <file-code-icon />
            </template>
            复制源码
          </t-dropdown-item>
        </t-dropdown-menu>
      </t-dropdown>
    </div>
    <html-design-preview :doc="current" class="html-design-aside__body" />
  </div>
</template>
<script lang="ts" setup>
import dayjs from 'dayjs'
import { MessageUtil } from '@/utils/modal'
import { blobToBase64 } from '@/utils/file/CovertUtil'
import {
  CopyIcon,
  DownloadIcon,
  FileCodeIcon,
  FolderOpenIcon,
  MoreIcon,
  RefreshIcon
} from 'tdesign-icons-vue-next'
import type { DropdownProps } from 'tdesign-vue-next'
import {
  buildDesignHtmlFileName,
  buildDesignHtmlOutputsDir,
  exportDesignHtmlPng,
  getDesignHtmlStore
} from '@/windows/main/modules/designHtml'
import type { ChatStatus } from '@/windows/main/modules/chat'
import HtmlDesignPreview from './HtmlDesignPreview.vue'

const props = withDefaults(
  defineProps<{
    sandbox?: string
    /** 用户工作空间：已选择时「文件夹中显示」优先打开它 */
    workspace?: string
    /** 侧边栏全屏：HTML 引擎无节点模型，仅放大预览（预览组件自适应容器） */
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

const store = computed(() => getDesignHtmlStore(props.sandbox ?? ''))
const current = computed(() => store.value.current.value)

const selected = ref<number | undefined>(undefined)
const busy = ref(false)

/** 聊天进行中（pending / streaming）：禁用手动切换设计稿，避免干扰 AI 作答 */
const isChatRunning = computed(() => props.status === 'pending' || props.status === 'streaming')

const emptyText = '请先让 AI 创建 HTML 设计稿'

const docOptions = computed(() =>
  store.value.files.value.map((file) => ({
    label: file.title ? `${file.title}（${file.name}.html）` : `${file.name}.html`,
    value: file.version
  }))
)

/** 文件列表刷新后，若当前已有打开的设计稿则保持选中态 */
const syncSelected = () => {
  selected.value = current.value?.version
}

onMounted(async () => {
  await store.value.refreshFiles()
  const files = store.value.files.value
  // 默认打开最新（最后一个）版本的设计稿
  if (files.length && !current.value) {
    await store.value.open(files[files.length - 1].version)
  }
  syncSelected()
})

watch(
  () => store.value.files.value,
  () => syncSelected(),
  { deep: true }
)

// AI 通过 html_create / html_write / html_open 变更当前设计稿 → 同步下拉选中
watch(
  () => current.value?.version,
  (version) => {
    selected.value = version
  }
)

const handleSelect = (version: unknown) => {
  const v = typeof version === 'number' ? version : undefined
  if (v == null) return
  if (current.value?.version === v) return
  void store.value.open(v)
}

const handleRefresh = () => {
  void store.value.refreshFiles()
}

/** 复制当前设计稿为图片到剪贴板 */
const handleCopy = async () => {
  const doc = current.value
  if (!doc) return
  busy.value = true
  try {
    const blob = await exportDesignHtmlPng(doc)
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

/** 下载当前设计稿为图片（选择保存路径，文件名 title+时间戳） */
const handleDownload = async () => {
  const doc = current.value
  if (!doc) return
  busy.value = true
  try {
    const blob = await exportDesignHtmlPng(doc)
    const name = `${doc.title || doc.name || 'design'}-${dayjs().format('YYYYMMDDHHmmss')}.png`
    const path = await window.preload.inject.dialog.save({
      title: '保存设计稿图片',
      defaultPath: name,
      filters: [{ name: 'PNG 图片', extensions: ['png'] }]
    })
    if (!path) return
    await window.preload.fs.writeBinaryFile(path, await blob.arrayBuffer())
    MessageUtil.success('已保存设计稿图片')
  } catch (e) {
    MessageUtil.error('保存失败', e)
  } finally {
    busy.value = false
  }
}

const handleAction: DropdownProps['onClick'] = (data) => {
  if (data.value === 'copy') void handleCopy()
  else if (data.value === 'download') void handleDownload()
  else if (data.value === 'source') {
    const doc = current.value
    if (!doc) return
    void window.preload.inject.clipboard.copyText(doc.html).then((ok) => {
      if (ok) MessageUtil.success('已复制 HTML 源码')
      else MessageUtil.error('复制失败')
    })
  } else if (data.value === 'folder') {
    if (selected.value) {
      window.preload.inject.shell.showItemInFolder(
        window.preload.path.join(
          buildDesignHtmlOutputsDir(props.sandbox ?? ''),
          buildDesignHtmlFileName(selected.value)
        )
      )
    } else {
      window.preload.inject.shell.openPath(
        props.workspace || buildDesignHtmlOutputsDir(props.sandbox ?? '')
      )
    }
  }
}
</script>
<style scoped lang="less">
.html-design-aside {
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
  }
}
</style>
