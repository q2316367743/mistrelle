<template>
  <div class="chat-list">
    <VList :data="rows" :item-size="36" style="height: 100%">
      <template #default="{ item }">
        <div
          v-if="item.kind === 'header'"
          class="group-header"
          :title="item.workspace || undefined"
        >
          <button class="group-header__main" type="button" @click="toggleGroup(item.key)">
            <chevron-right-icon v-if="item.collapsed" class="group-header__arrow" />
            <chevron-down-icon v-else class="group-header__arrow" />
            <folder-open-icon v-if="item.workspace && !item.collapsed" class="group-header__icon" />
            <folder-icon v-else-if="item.workspace" class="group-header__icon" />
            <task-icon v-else class="group-header__icon" />
            <span class="group-header__name ellipsis">{{ item.name }}</span>
          </button>
          <t-button
            v-if="item.workspace"
            theme="default"
            variant="text"
            size="small"
            shape="square"
            class="group-header__add"
            title="在该项目下新建聊天"
            @click="newInProject(item.workspace)"
          >
            <plus-icon />
          </t-button>
        </div>
        <button
          v-else
          class="menu-item"
          :class="{ active: isActive(`/chat/${item.chat.id}`), privacy: item.chat.privacy }"
          type="button"
          :title="item.chat.name"
          @contextmenu="onContextmenu($event, item.chat)"
          @click="goTo(`/chat/${item.chat.id}`)"
        >
          <PaletteIcon v-if="item.chat.type === 'design'" class="menu-icon" />
          <EditIcon v-else-if="item.chat.type === 'writing'" class="menu-icon" />
          <WorkIcon v-else class="menu-icon" />
          <t-tag v-if="item.chat.privacy" theme="danger" variant="light" size="small" class="shrink-0">
            私
          </t-tag>
          <span class="ellipsis flex-1 min-w-0">{{ item.chat.name }}</span>
          <t-loading v-if="isStreaming(item.chat)" size="small" />
        </button>
      </template>
    </VList>
  </div>
</template>

<script lang="ts" setup>
import { VList } from 'virtua/vue'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  EditIcon,
  FolderIcon,
  FolderOpenIcon,
  PaletteIcon,
  PlusIcon,
  TaskIcon,
  WorkIcon
} from 'tdesign-icons-vue-next'
import type { AiChatItem } from '@/entity/ai'
import { buildChatMainKey, getChatSessionStatus } from '@/windows/main/modules/chat'
import { openChatContextmenu } from '@/windows/main/pages/app/chat-func'
import { useRoute, useRouter } from 'vue-router'
import { useChatGroups } from './useChatGroups'

const route = useRoute()
const router = useRouter()

const { rows, toggleGroup } = useChatGroups()

const isActive = (path: string) => route.path === path

const goTo = (path: string) => {
  if (route.path !== path) {
    router.push(path)
  }
}

/** 在指定项目（工作目录）下新建聊天：经路由 query 预填 /new 页的工作目录 */
const newInProject = (workspace: string) => {
  router.push({ path: '/new', query: { workspace } })
}

const handleHome = () => goTo('/')

/** 会话是否正在作答（读取会话管理器中的实时状态，保持响应式） */
const isStreaming = (item: AiChatItem): boolean => {
  const status = getChatSessionStatus(buildChatMainKey(item.id))
  return status === 'pending' || status === 'streaming'
}

const onContextmenu = (e: MouseEvent, item: AiChatItem) => {
  // 进行中的会话禁用右键（重命名 / 删除），避免打断作答
  if (isStreaming(item)) return
  openChatContextmenu(e, item, handleHome)
}
</script>

<style scoped lang="less">
.chat-list {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.group-header {
  display: flex;
  align-items: center;
  gap: var(--td-comp-margin-s);
  width: 196px;
  min-width: 196px;
  min-height: var(--td-comp-size-m);

  &__main {
    display: flex;
    flex: 1;
    align-items: center;
    gap: var(--td-comp-margin-s);
    min-width: 0;
    min-height: var(--td-comp-size-m);
    padding: 0 var(--td-comp-paddingLR-s);
    color: var(--td-text-color-secondary);
    font: var(--td-font-body-small);
    text-align: left;
    background: transparent;
    border: none;
    border-radius: var(--td-radius-small);
    outline: none;
    cursor: pointer;
    transition:
      background var(--fluent-transition-fast),
      color var(--fluent-transition-fast);

    &:hover {
      background: var(--fluent-item-hover);
    }

    &:focus-visible {
      box-shadow: var(--fluent-focus-ring);
    }
  }

  &__arrow {
    flex: 0 0 auto;
    width: 14px;
    height: 14px;
  }

  &__icon {
    flex: 0 0 auto;
    width: 16px;
    height: 16px;
  }

  &__name {
    flex: 1;
    min-width: 0;
  }

  // 新建入口仅在悬停分组头时出现，避免常驻干扰列表
  &__add {
    flex: 0 0 auto;
    opacity: 0;
    transition: opacity var(--fluent-transition-fast);

    .group-header:hover & {
      opacity: 1;
    }
  }
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
