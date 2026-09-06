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
    <div class="html-design-aside__body" :class="{ 'html-design-aside__body--split': fullscreen }">
      <html-element-tree
        v-if="fullscreen"
        :nodes="treeNodes"
        :selected-path="selectedPath"
        @select="handleElementSelect"
      />
      <html-design-preview
        :doc="current"
        :selected-path="selectedPath"
        class="html-design-aside__preview"
        @select="handleElementSelect"
        @pick="handleElementPick"
        @tree-change="handleTreeChange"
      />
    </div>
  </div>
</template>
<script lang="ts" setup>
import { MessageUtil } from '@/utils/modal'
import {
  CopyIcon,
  DownloadIcon,
  FileCodeIcon,
  FolderOpenIcon,
  MoreIcon,
  RefreshIcon
} from 'tdesign-icons-vue-next'
import {
  getDesignHtmlStore
} from '@/windows/main/modules/designHtml'
import type { ChatStatus } from '@/windows/main/modules/chat'
import type { HtmlTreeNode } from '@/components/chat/design/htmlElementBridge'
import { HTML_ELEMENT_PICK_KEY } from '@/components/chat/design/htmlElementBridge'
import HtmlDesignPreview from './HtmlDesignPreview.vue'
import HtmlElementTree from './HtmlElementTree.vue'
import { useHtmlDesignActions } from './useHtmlDesignActions'

const props = withDefaults(
  defineProps<{
    sandbox?: string
    /** 用户工作空间：已选择时「文件夹中显示」优先打开它 */
    workspace?: string
    /** 侧边栏全屏：展示「左元素树 + 右预览」双栏布局 */
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
const selectedPath = ref<string | undefined>(undefined)
const treeNodes = ref<HtmlTreeNode[]>([])

/** 聊天进行中（pending / streaming）：禁用手动切换设计稿，避免干扰 AI 作答 */
const isChatRunning = computed(() => props.status === 'pending' || props.status === 'streaming')

const emptyText = '请先让 AI 创建 HTML 设计稿'

/** 设计稿预览 → 聊天输入框的注入回调（useChatSession provide），为空时降级为复制描述链 */
const pickHtmlElement = inject(HTML_ELEMENT_PICK_KEY, null)

const { busy, handleAction } = useHtmlDesignActions({
  current: () => current.value ?? undefined,
  selectedVersion: () => selected.value,
  sandbox: () => props.sandbox ?? '',
  workspace: () => props.workspace ?? ''
})

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

/** 树 / 预览任意来源的选中变化（undefined = 取消选中） */
const handleElementSelect = (path: string | undefined) => {
  selectedPath.value = path
}

const handleTreeChange = (nodes: HtmlTreeNode[]) => {
  treeNodes.value = nodes
}

/** 双击元素：注入聊天输入框（AI 按描述链定位修改）；无桥接时降级为复制描述链 */
const handleElementPick = async (payload: { path: string; chain: string }) => {
  const doc = current.value
  if (!doc) return
  const elementRef = { version: doc.version, path: payload.path, label: payload.chain }
  if (pickHtmlElement) {
    pickHtmlElement(elementRef)
    MessageUtil.success('已将设计稿元素添加到输入框')
    return
  }
  const ok = await window.preload.inject.clipboard.copyText(payload.chain)
  if (ok) {
    MessageUtil.success('已复制元素描述链')
  } else {
    MessageUtil.error('复制失败')
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
    display: flex;

    &--split {
      margin-bottom: 8px;
      gap: 8px;
    }
  }

  &__preview {
    flex: 1;
    min-width: 0;
  }
}
</style>
