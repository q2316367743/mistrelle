<template>
  <div class="l-chat-aside">
    <t-select v-model="active">
      <t-option value="overview" label="概览" />
      <t-option value="workspace" label="工作空间" :disabled="!workspace" />
      <t-option value="sandbox" label="沙盒空间" :disabled="!sandbox" />
    </t-select>
    <div v-if="active === 'overview'" class="l-chat-aside__content">
      <sub-title title="任务进程" />
      <todo-list :todos="todos" />
      <sub-title title="产物">
        <template #actions>
          <t-button theme="primary" size="small" variant="text" shape="square" @click="openSandbox">
            <template #icon>
              <folder-open-icon />
            </template>
          </t-button>
        </template>
      </sub-title>
      <div
        v-for="output in outputs"
        class="product-item"
        :key="output.path"
        @click="openFilePreview({ fileName: output.name, fullPath: output.path })"
      >
        <file-icon />
        <span class="ellipsis w-180px">{{ output.name }}</span>
      </div>
    </div>
    <div v-else-if="active === 'workspace' || active === 'sandbox'" class="l-chat-aside__content">
      <sub-title :title="active === 'workspace' ? '工作空间' : '沙盒空间'">
        <template #actions>
          <t-button theme="primary" size="small" variant="text" shape="square" @click="handleTreeRefresh">
            <template #icon>
              <refresh-icon />
            </template>
          </t-button>
        </template>
      </sub-title>
      <t-tree
        :key="treeKey"
        :data="treeData"
        :load="treeLoad"
        :icon="treeIcon"
        v-model:expanded="expanded"
        hover
        line
        transition
        expand-on-click-node
        empty="暂无文件"
        @click="handleTreeClick"
      />
    </div>
  </div>
</template>
<script lang="ts" setup>
import { ChatMessage, type ToolCallContent, type TodoItem } from '@/domain'
import {
  FileIcon,
  FileMarkdownIcon,
  FolderIcon,
  FolderOpenIcon,
  RefreshIcon
} from 'tdesign-icons-vue-next'
import type { TreeOptionData, TreeNodeModel } from 'tdesign-vue-next'
import { openFilePreview } from '@/components/chat/chat-assistant/modals/FilePreviewDialog'
import TodoList from '@/components/chat/TodoList.vue'

interface WorkspaceTreeNode {
  label: string
  value: string
  isDirectory: boolean
  children?: boolean | WorkspaceTreeNode[]
}

const props = defineProps({
  messages: {
    type: Array as PropType<Array<ChatMessage>>,
    default: () => []
  },
  sandbox: {
    type: String
  },
  workspace: {
    type: String
  },
  todos: {
    type: Array as PropType<TodoItem[]>,
    default: () => []
  }
})

const toolCallNames = ['file_write_xlsx', 'file_write']

const outputs = computed(() => {
  const map = new Map<string, string>()
  props.messages.forEach((message) => {
    if (message.role === 'assistant') {
      message.content?.forEach((item) => {
        if (item.type !== 'toolcall' || item.status !== 'complete') return
        const tc = item as ToolCallContent
        if (!toolCallNames.includes(tc.data.toolCallName)) return
        const args = tc.data.args
        if (!args) return
        try {
          const parsed = JSON.parse(args)
          const fullPath: string = parsed.path ?? ''
          if (!fullPath) return
          if (map.has(fullPath)) return
          const fileName = window.preload.path.basename(fullPath)
          map.set(fullPath, fileName)
        } catch {
          // ignore parse errors
        }
      })
    }
  })
  return Array.from(map)
    .map(([path, name]) => ({ name, path }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

const active = ref('overview')

const NOISE_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  '.cache',
  '.idea',
  '.vscode',
  '.DS_Store',
  'coverage',
  'build',
  'target',
  '__pycache__'
])

const currentRoot = computed(() => {
  // 沙盒空间仅展示 outputs 目录
  if (active.value === 'sandbox') return props.sandbox ? window.preload.path.join(props.sandbox, 'outputs') : ''
  return props.workspace
})

const treeData = computed<WorkspaceTreeNode[]>(() => {
  const root = currentRoot.value
  if (!root) return []
  const label = window.preload.path.basename(root) || root
  return [{ label, value: root, isDirectory: true, children: true }]
})

const isWorkspaceNode = (data: TreeOptionData): data is WorkspaceTreeNode => 'isDirectory' in data

const treeLoad = async ({ data }: { data: TreeOptionData }): Promise<WorkspaceTreeNode[]> => {
  if (!isWorkspaceNode(data)) return []
  try {
    const items = await window.preload.fs.readDir(data.value)
    return items
      .filter((item) => (item.isDirectory || item.isFile) && !NOISE_NAMES.has(item.name))
      .map<WorkspaceTreeNode>((item) => ({
        label: item.name,
        value: item.path,
        isDirectory: item.isDirectory,
        children: item.isDirectory ? true : undefined
      }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.label.localeCompare(b.label)
      })
  } catch {
    return []
  }
}

const handleTreeClick = ({ node }: { node: TreeNodeModel<TreeOptionData> }) => {
  const data = node.data
  if (!isWorkspaceNode(data) || data.isDirectory) return
  openFilePreview({ fileName: data.label, fullPath: data.value })
}

const treeIcon = (_h: unknown, node: TreeNodeModel<TreeOptionData>) => {
  const data = node.data
  if (!isWorkspaceNode(data)) return h(FileIcon)
  if (data.isDirectory) return h(FolderIcon)
  if (data.label.toLowerCase().endsWith('.md')) return h(FileMarkdownIcon)
  return h(FileIcon)
}

const openSandbox = () => {
  window.preload.inject.shell.showItemInFolder(`${props.sandbox}/outputs`)
}

const expanded = ref<string[]>([])

const refreshKey = ref(0)

// 空间路径或手动刷新时 key 变化，强制重建 tree 以重载数据
const treeKey = computed(() => `${currentRoot.value}|${refreshKey.value}`)

const resetExpanded = () => {
  expanded.value = currentRoot.value ? [currentRoot.value] : []
}

const handleTreeRefresh = () => {
  refreshKey.value++
  resetExpanded()
}

watch(currentRoot, resetExpanded, { immediate: true })
</script>
<style scoped lang="less">
.l-chat-aside {
  height: 100%;
  padding: 8px 0 8px 8px;

  &__content {
    margin-top: 8px;
    height: calc(100vh - 104px);
    overflow: auto;
  }
  .product-item {
    padding: 4px;
    cursor: pointer;
    transition: background-color 0.3s ease-in-out;
    border-radius: var(--td-radius-medium);
    &:hover {
      background-color: var(--td-bg-color-component-hover);
    }
    span {
      margin-left: 8px;
    }
  }
}
</style>
