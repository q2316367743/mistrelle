<template>
  <div class="discussion-list">
    <div class="section-title">
      <span>讨论组</span>
      <t-button
        theme="primary"
        variant="text"
        shape="square"
        size="small"
        @click="openDiscussionPut()"
      >
        <template #icon>
          <add-icon />
        </template>
      </t-button>
    </div>
    <VList :data="discussions" :itemSize="36" style="height: 100%;">
      <template #default="{ item }">
        <button
          class="menu-item"
          :class="{ active: isActive(`/discussion/${item.id}`) }"
          type="button"
          @click="goTo(`/discussion/${item.id}`)"
          @contextmenu="openDiscussionContextmenu($event, item.id)"
        >
          <UsergroupIcon class="menu-icon" />
          <span>{{ item.name }}</span>
        </button>
      </template>
    </VList>
  </div>
</template>

<script lang="ts" setup>
import { VList } from 'virtua/vue'
import { AddIcon, UsergroupIcon } from 'tdesign-icons-vue-next'
import { useAiDiscussionStore } from '@/store'
import { openDiscussionPut, openDiscussionContextmenu } from '@/pages/app/discussion-func'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const discussions = computed(() => useAiDiscussionStore().state)

const isActive = (path: string) => route.path === path

const goTo = (path: string) => {
  if (route.path !== path) {
    router.push(path)
  }
}
</script>

<style scoped lang="less">
.discussion-list {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.section-title {
  flex-shrink: 0;
  padding: var(--td-comp-paddingTB-xs) var(--td-comp-paddingLR-s);
  color: var(--td-text-color-placeholder);
  font: var(--td-font-mark-small);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: var(--td-comp-margin-s);
  width: calc(100% - 16px);
  min-width: 204px;
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
