<template>
  <div class="free-writing-aside">
    <div class="free-writing-aside__toolbar">
      <t-select v-model="root" class="free-writing-aside__root">
        <t-option value="outputs" label="产出文档" />
        <t-option value="workspace" label="工作空间" :disabled="!workspace" />
      </t-select>
      <t-button theme="primary" variant="text" shape="square" title="新建文档" @click="handleCreate">
        <template #icon>
          <file-add-icon />
        </template>
      </t-button>
      <t-button theme="primary" variant="text" shape="square" title="刷新" @click="handleRefresh">
        <template #icon>
          <refresh-icon />
        </template>
      </t-button>
    </div>
    <div class="free-writing-aside__body">
      <div class="free-writing-aside__tree">
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
          empty="暂无文档"
          @click="handleTreeClick"
        />
      </div>
      <div class="free-writing-aside__doc">
        <div v-if="currentFile" class="free-writing-aside__doc-toolbar">
          <t-radio-group v-model="mode" size="small" theme="button" variant="default-filled">
            <t-radio-button value="edit">编辑</t-radio-button>
            <t-radio-button value="preview">预览</t-radio-button>
          </t-radio-group>
          <t-tag theme="primary" variant="light" size="small" class="free-writing-aside__doc-name">
            {{ currentFile.name }}
          </t-tag>
        </div>
        <div v-if="currentFile" class="free-writing-aside__doc-content">
          <monaco-editor-view
            v-show="mode === 'edit'"
            :value="content"
            language="markdown"
            height="100%"
            :minimap="false"
            :readonly="false"
            @change="handleContentChange"
          />
          <div v-show="mode === 'preview'" class="free-writing-aside__preview">
            <chat-content :content="content" />
          </div>
        </div>
        <div v-else class="free-writing-aside__empty">从左侧选择文档，或点击 + 新建</div>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import type { TreeOptionData, TreeNodeModel } from 'tdesign-vue-next'
import { ChatContent } from '@tdesign-vue-next/chat'
import { FileIcon, FileMarkdownIcon, FolderIcon, RefreshIcon, FileAddIcon } from 'tdesign-icons-vue-next'
import { debounce } from 'es-toolkit'

type Root = 'outputs' | 'workspace'

interface DocTreeNode {
  label: string
  value: string
  isDirectory: boolean
  children?: boolean | DocTreeNode[]
}

const props = defineProps<{
  sandbox?: string
  workspace?: string
}>()

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

const root = ref<Root>('outputs')
const mode = ref<'edit' | 'preview'>('edit')
const expanded = ref<string[]>([])
const refreshKey = ref(0)

/** 当前编辑的文档信息 */
const currentFile = ref<{ name: string; path: string } | null>(null)
const content = ref('')

const currentRoot = computed(() => {
  if (root.value === 'outputs') {
    return props.sandbox ? window.preload.path.join(props.sandbox, 'outputs') : ''
  }
  return props.workspace ?? ''
})

const treeKey = computed(() => `${currentRoot.value}|${refreshKey.value}`)

const treeData = computed<DocTreeNode[]>(() => {
  const rootPath = currentRoot.value
  if (!rootPath) return []
  const label = window.preload.path.basename(rootPath) || rootPath
  return [{ label, value: rootPath, isDirectory: true, children: true }]
})

const isDocNode = (data: TreeOptionData): data is DocTreeNode => 'isDirectory' in data

const treeLoad = async ({ data }: { data: TreeOptionData }): Promise<DocTreeNode[]> => {
  if (!isDocNode(data)) return []
  try {
    const items = await window.preload.fs.readDir(data.value)
    return items
      .filter((item) => (item.isDirectory || item.isFile) && !NOISE_NAMES.has(item.name))
      .map<DocTreeNode>((item) => ({
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

const handleTreeClick = async ({ node }: { node: TreeNodeModel<TreeOptionData> }) => {
  const data = node.data
  if (!isDocNode(data) || data.isDirectory) return
  await openDoc(data.value, data.label)
}

const treeIcon = (_h: unknown, node: TreeNodeModel<TreeOptionData>) => {
  const data = node.data
  if (!isDocNode(data)) return h(FileIcon)
  if (data.isDirectory) return h(FolderIcon)
  if (data.label.toLowerCase().endsWith('.md')) return h(FileMarkdownIcon)
  return h(FileIcon)
}

const openDoc = async (path: string, name: string) => {
  try {
    const text = await window.preload.fs.readTextFile(path)
    currentFile.value = { name, path }
    content.value = text
    mode.value = 'edit'
  } catch {
    // 读取失败（权限 / 编码）不切换文档
  }
}

const handleContentChange = (value?: string) => {
  content.value = value ?? ''
  void saveDoc()
}

/** 防抖落盘：编辑内容写入当前文档文件 */
const saveDoc = debounce(async () => {
  if (!currentFile.value) return
  try {
    await window.preload.fs.writeTextFile(currentFile.value.path, content.value)
  } catch {
    // 落盘失败保持内存内容，不阻断编辑
  }
}, 800)

const handleCreate = async () => {
  const dir = currentRoot.value
  if (!dir) return
  const name = `新文档-${Date.now()}.md`
  const path = window.preload.path.join(dir, name)
  await window.preload.fs.writeTextFile(path, '# 新文档\n')
  refreshKey.value++
  await openDoc(path, name)
}

const handleRefresh = () => {
  refreshKey.value++
}

const resetExpanded = () => {
  expanded.value = currentRoot.value ? [currentRoot.value] : []
}

watch(currentRoot, resetExpanded, { immediate: true })
</script>
<style scoped lang="less">
.free-writing-aside {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 8px 0 8px 8px;

  &__toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__root {
    flex: 1;
    min-width: 0;
  }

  &__body {
    margin-top: 8px;
    flex: 1;
    min-height: 0;
    display: flex;
    gap: 8px;
  }

  &__tree {
    width: 150px;
    flex-shrink: 0;
    overflow: auto;
    border-radius: var(--td-radius-medium);
    border: 1px solid var(--td-border-level-1-color);
    padding: 4px;
  }

  &__doc {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    border-radius: var(--td-radius-medium);
    border: 1px solid var(--td-border-level-1-color);
    overflow: hidden;
  }

  &__doc-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    border-bottom: 1px solid var(--td-border-level-1-color);
  }

  &__doc-name {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__doc-content {
    flex: 1;
    min-height: 0;
  }

  &__preview {
    height: 100%;
    overflow: auto;
    padding: 12px;
    box-sizing: border-box;
  }

  &__empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--td-text-color-placeholder);
    font-size: var(--td-font-size-body-small);
  }
}
</style>
