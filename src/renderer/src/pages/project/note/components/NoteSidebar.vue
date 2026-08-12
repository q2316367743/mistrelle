<template>
  <div class="note-sidebar" @contextmenu="handleRootContext">
    <div class="note-sidebar__top">
      <div>笔记</div>
      <t-button theme="primary" variant="text" shape="square">
        <template #icon>
          <add-icon />
        </template>
      </t-button>
    </div>
    <div class="note-sidebar__tree">
      <note-tree-node
        v-for="node in tree"
        :key="node.key"
        :node="node"
        :expanded="expandedKeys"
        :creating="creating"
        :active-key="activeKey"
        @toggle="handleToggle"
        @open="emit('open', $event)"
        @create="handleCreate"
        @cancel-create="creating = undefined"
        @rename="emit('rename', $event)"
        @delete="emit('delete', $event)"
      />
      <note-create-input
        v-if="creating?.parentKey === ''"
        class="note-sidebar__create-row"
        @confirm="handleRootCreateConfirm"
        @cancel="creating = undefined"
      />
      <t-empty
        v-if="tree.length === 0"
        class="note-sidebar__empty"
        title="暂无笔记"
        description="右键空白处新建"
      />
    </div>
  </div>
</template>
<script lang="ts" setup>
import { openRootContextmenu } from './noteContextmenu'
import type { NoteNode } from '@/modules/note'
import { AddIcon } from 'tdesign-icons-vue-next'
import NoteCreateInput from './NoteCreateInput.vue'
import NoteTreeNode from './NoteTreeNode.vue'

interface CreatingState {
  parentKey: string
  kind: 'note' | 'folder'
}

defineProps<{
  tree: NoteNode[]
  /** 当前激活笔记 key（用于高亮） */
  activeKey: string | null
}>()

const emit = defineEmits<{
  (e: 'open', key: string): void
  (e: 'create', kind: 'note' | 'folder', parentKey: string, name: string): void
  (e: 'rename', node: NoteNode): void
  (e: 'delete', node: NoteNode): void
}>()

const expandedKeys = ref(new Set<string>())
const creating = ref<CreatingState>()

const handleToggle = (key: string) => {
  const next = new Set(expandedKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedKeys.value = next
}

/** 展开 parentKey 并进入内联新建状态 */
const startCreate = (parentKey: string, kind: 'note' | 'folder') => {
  creating.value = { parentKey, kind }
  if (parentKey) {
    const next = new Set(expandedKeys.value)
    next.add(parentKey)
    expandedKeys.value = next
  }
}

const handleRootContext = (e: MouseEvent) => {
  openRootContextmenu(e, {
    createNote: () => startCreate('', 'note'),
    createFolder: () => startCreate('', 'folder')
  })
}

/**
 * 统一处理新建：菜单唤起（无 name）→ 进入内联输入；
 * 内联输入确认（有 name）→ 交给页面真正创建。
 */
const handleCreate = (payload: { parentKey: string; kind: 'note' | 'folder'; name?: string }) => {
  if (payload.name) {
    creating.value = undefined
    emit('create', payload.kind, payload.parentKey, payload.name)
    return
  }
  startCreate(payload.parentKey, payload.kind)
}

const handleRootCreateConfirm = (name: string) => {
  const kind = creating.value?.kind ?? 'note'
  creating.value = undefined
  if (!name) return
  emit('create', kind, '', name)
}
</script>
<style scoped lang="less">
.note-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;

  &__top {
    height: 24px;
    line-height: 32px;
    font-size: var(--td-font-size-title-medium);
    font-weight: bold;
    transition: all 0.1s ease-in-out;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__tree {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 8px;
    box-sizing: border-box;
  }

  &__create-row {
    padding: 4px 10px 4px 28px;
  }

  &__empty {
    margin-top: 24px;
  }
}
</style>
