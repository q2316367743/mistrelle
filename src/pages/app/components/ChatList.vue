<template>
  <div class="chat-list">
    <VList :data="chats" :itemSize="36" style="height: 100%">
      <template #default="{ item }">
        <button
          class="menu-item"
          :class="{ active: isActive(`/chat/${item.id}`) }"
          type="button"
          :title="item.name"
          @contextmenu="openChatContextmenu($event, item, handleHome)"
          @click="goTo(`/chat/${item.id}`)"
        >
          <FolderIcon class="menu-icon" />
          <span class="ellipsis w-160px">{{ item.name }}</span>
        </button>
      </template>
    </VList>
  </div>
</template>

<script lang="ts" setup>
import { VList } from 'virtua/vue'
import { FolderIcon } from 'tdesign-icons-vue-next'
import { useAiChatStore } from '@/store'
import { openChatContextmenu } from '@/pages/app/chat-func'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const chats = computed(() => useAiChatStore().state.sort((a, b) => b.createdAt - a.createdAt))

const isActive = (path: string) => route.path === path

const goTo = (path: string) => {
  if (route.path !== path) {
    router.push(path)
  }
}

const handleHome = () => goTo('/')
</script>

<style scoped lang="less">
.chat-list {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: var(--td-comp-margin-s);
  width: 196px;
  min-width: 196px;
  min-height: var(--td-comp-size-m);
  padding: 0 var(--td-comp-paddingLR-s);
  color: var(--td-text-color-primary);
  font: var(--td-font-body-medium);
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--td-radius-small);
  outline: none;
  cursor: pointer;
  transition:
    background var(--fluent-transition-fast),
    border-color var(--fluent-transition-fast),
    box-shadow var(--fluent-transition-fast),
    color var(--fluent-transition-fast);

  &:hover {
    background: var(--fluent-item-hover);
  }

  &:focus-visible {
    box-shadow: var(--fluent-focus-ring);
  }

  position: relative;

  &::before {
    position: absolute;
    left: 0;
    width: 3px;
    height: 18px;
    content: '';
    background: transparent;
    border-radius: var(--td-radius-round);
    transition: background var(--fluent-transition-fast);
  }

  &.active {
    color: var(--td-text-color-brand);
    background: var(--fluent-item-selected);
    border-color: var(--fluent-sidebar-border);

    &:hover {
      background: var(--fluent-item-selected);
    }

    &::before {
      background: var(--fluent-item-selected-border);
    }
  }
}

.menu-icon {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
}
</style>
