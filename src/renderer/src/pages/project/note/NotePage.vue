<template>
  <div class="h-full w-full">
    <div class="note-page">
      <aside class="note-page__sidebar">
        <note-sidebar
          :tree="tree"
          :active-key="activeKey"
          @open="open"
          @create="create"
          @rename="handleRename"
          @delete="handleDelete"
        />
      </aside>
      <main class="note-page__main">
        <template v-if="tabs.length > 0">
          <div class="note-page__tabs">
            <t-tabs v-model="activeTabValue" size="medium" @remove="handleTabRemove">
              <t-tab-panel v-for="tab in tabs" :key="tab.key" :value="tab.key" removable>
                <template #label>
                  <span class="note-page__tab-label">
                    <span class="note-page__tab-name">{{ tab.name }}</span>
                    <i v-if="tab.dirty" class="note-page__tab-dot" />
                  </span>
                </template>
              </t-tab-panel>
            </t-tabs>
          </div>
          <note-editor
            v-if="activeTab"
            :key="activeTab.key"
            :root="root"
            :content="activeTab.content"
            :base-dir="baseDir"
            :note-key="activeTab.key"
            @change="handleChange"
          />
        </template>
        <t-empty
          v-else
          class="note-page__empty"
          title="选择或新建一篇笔记"
          description="左侧右键可新建笔记或文件夹"
        />
      </main>
    </div>
  </div>
</template>
<script lang="ts" setup>
import type { NoteNode } from '@/modules/note'
import NoteEditor from './components/NoteEditor.vue'
import NoteSidebar from './components/NoteSidebar.vue'
import { openNoteRenameDialog } from './modals/NoteRenameDialog'
import { useNotePage } from './useNotePage'

const props = defineProps<{ id: string }>()

const {
  tree,
  tabs,
  activeKey,
  activeTab,
  activeTabValue,
  baseDir,
  root,
  handleChange,
  load,
  open,
  close,
  create,
  rename,
  remove,
  siblingNames
} = useNotePage(toRef(props, 'id'))

onMounted(() => {
  void load()
})

const handleRename = (node: NoteNode) => {
  openNoteRenameDialog(
    { kind: node.type, currentName: node.name, takenNames: siblingNames(node) },
    (newName) => {
      void rename(node.type, node, newName)
    }
  )
}

const handleDelete = (node: NoteNode) => {
  void remove(node.type, node)
}

const handleTabRemove = (options: { value: string | number }) => {
  void close(String(options.value))
}
</script>
<style scoped lang="less">
.note-page {
  display: flex;
  width: 100%;
  height: 100%;

  &__sidebar {
    flex-shrink: 0;
    width: 240px;
    height: 100%;
    border-right: 1px solid var(--td-border-level-1-color);
    background: var(--fluent-acrylic-bg);
    backdrop-filter: var(--fluent-acrylic-blur);
  }

  &__main {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  &__tabs {
    flex-shrink: 0;
    border-bottom: 1px solid var(--td-border-level-1-color);
    background: var(--fluent-acrylic-bg);
    backdrop-filter: var(--fluent-acrylic-blur);
    padding: 0 8px;

    :deep(.t-tabs__content) {
      display: none;
    }

    :deep(.t-tabs__nav) {
      margin-bottom: 0;
    }
  }

  &__tab-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  &__tab-name {
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__tab-dot {
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--td-warning-color);
  }

  &__empty {
    margin: auto;
  }
}
</style>
