<template>
  <div class="note-tree-node__wrap">
    <div
      class="note-tree-node"
      :class="{
        'is-active': node.type === 'note' && node.key === activeKey,
        'is-expanded': node.type === 'folder' && expanded.has(node.key)
      }"
      @click="handleClick"
      @contextmenu="handleMenu"
    >
      <chevron-right-icon
        v-if="node.type === 'folder'"
        class="note-tree-node__arrow"
        :class="{ 'is-rotated': expanded.has(node.key) }"
      />
      <span v-else class="note-tree-node__arrow-placeholder" />
      <folder-icon v-if="node.type === 'folder'" class="note-tree-node__icon" />
      <sticky-note-icon v-else class="note-tree-node__icon" />
      <span class="note-tree-node__name" :title="node.key">{{ node.name }}</span>
    </div>
    <div
      v-if="node.type === 'folder' && expanded.has(node.key)"
      class="note-tree-node__children"
    >
      <note-tree-node
        v-for="child in node.children"
        :key="child.key"
        :node="child"
        :expanded="expanded"
        :creating="creating"
        :active-key="activeKey"
        @toggle="emit('toggle', $event)"
        @open="emit('open', $event)"
        @create="emit('create', $event)"
        @cancel-create="emit('cancelCreate')"
        @rename="emit('rename', $event)"
        @delete="emit('delete', $event)"
      />
      <note-create-input
        v-if="creating && creating.parentKey === node.key"
        class="note-tree-node__create-row"
        @confirm="(name) => handleCreateConfirm(name)"
        @cancel="emit('cancelCreate')"
      />
    </div>
  </div>
</template>
<script lang="ts" setup>
import { ChevronRightIcon, FolderIcon, StickyNoteIcon } from 'tdesign-icons-vue-next'
import type { NoteNode } from '@/modules/note'
import { openNodeContextmenu } from './noteContextmenu'
import NoteCreateInput from './NoteCreateInput.vue'

interface CreatingState {
  parentKey: string
  kind: 'note' | 'folder'
}

const props = defineProps<{
  node: NoteNode
  /** 已展开的文件夹 key 集合 */
  expanded: Set<string>
  /** 正在新建的位置（parentKey 为相对根目录路径） */
  creating?: CreatingState
  /** 当前激活笔记 key（用于高亮） */
  activeKey: string | null
}>()

const emit = defineEmits<{
  (e: 'toggle', key: string): void
  (e: 'open', key: string): void
  (e: 'create', payload: { parentKey: string; kind: 'note' | 'folder'; name?: string }): void
  (e: 'cancelCreate'): void
  (e: 'rename', node: NoteNode): void
  (e: 'delete', node: NoteNode): void
}>()

const handleClick = () => {
  if (props.node.type === 'folder') emit('toggle', props.node.key)
  else emit('open', props.node.key)
}

const handleMenu = (e: MouseEvent) => {
  const node = props.node
  if (node.type === 'folder') {
    openNodeContextmenu(e, node, {
      createNote: () => emit('create', { parentKey: node.key, kind: 'note' }),
      createFolder: () => emit('create', { parentKey: node.key, kind: 'folder' }),
      rename: () => emit('rename', node),
      delete: () => emit('delete', node)
    })
    return
  }
  openNodeContextmenu(e, node, {
    rename: () => emit('rename', node),
    delete: () => emit('delete', node)
  })
}

/** 内联新建输入确认：直接转发给页面统一处理 */
const handleCreateConfirm = (name: string) => {
  emit('create', {
    parentKey: props.node.key,
    kind: props.creating?.kind ?? 'note',
    name
  })
}
</script>
<style scoped lang="less">
.note-tree-node {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  border-radius: var(--td-radius-small);
  cursor: pointer;
  color: var(--td-text-color-secondary);
  user-select: none;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;

  &:hover {
    background: var(--td-bg-color-component);
  }

  &.is-active {
    background: var(--td-brand-color-light);
    color: var(--td-brand-color);
  }

  &__arrow {
    flex-shrink: 0;
    font-size: 14px;
    transition: transform 0.2s ease;

    &.is-rotated {
      transform: rotate(90deg);
    }
  }

  &__arrow-placeholder {
    flex-shrink: 0;
    width: 14px;
  }

  &__icon {
    flex-shrink: 0;
    font-size: 15px;
  }

  &__name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--td-font-size-body-medium);
  }

  &__children {
    padding-left: 16px;
  }

  &__create-row {
    padding: 4px 10px 4px 28px;
  }
}
</style>
