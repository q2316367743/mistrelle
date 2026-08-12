<template>
  <div v-if="loading" class="group-chat__loading">
    <t-loading size="large" text="正在加载讨论组" />
  </div>
  <div v-else-if="!discussion" class="group-chat__loading">
    <t-empty type="fail" title="讨论组不存在" description="请从左侧重新选择讨论组" />
  </div>
  <t-layout v-else class="group-chat">
    <t-header class="group-chat__header">
      <div class="group-chat__title">
        <span class="group-chat__name">{{ discussion.name || '未命名讨论组' }}</span>
        <span class="group-chat__desc">
          {{ memberCount }} 位成员 · 输入 @ 选择成员，被 @ 的成员才会回复
        </span>
      </div>
      <div class="group-chat__header-actions">
        <group-chat-context-bar
          :chat="chat"
          :discussion="discussion"
          :compressing="compressing"
          @new-context="newContext"
          @compress="compressContext"
          @update-expiry="updateExpiryHours"
          @clear-log="confirmClearLog(clearLogically)"
          @clear-cache="confirmClearCache(clearCompletely)"
        />
        <t-button
          theme="default"
          variant="text"
          shape="square"
          :title="asideVisible ? '收起成员' : '成员'"
          @click="asideVisible = !asideVisible"
        >
          <template #icon><more-icon /></template>
        </t-button>
      </div>
    </t-header>

    <t-layout class="group-chat__body">
      <t-content class="group-chat__content">
        <group-chat-message-list ref="messageListRef" :chat="chat" :discussion="discussion" />
        <footer class="group-chat__footer">
          <group-chat-sender :roles="orderedRoles" :loading="running" @send="send" @stop="stop" />
        </footer>
      </t-content>
      <t-aside
        :width="asideWidth"
        :class="[{ 'is-collapsed': !asideVisible }, 'shrink-0']"
        class="group-chat__aside"
      >
        <group-chat-members :discussion="discussion" />
      </t-aside>
    </t-layout>
  </t-layout>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { MoreIcon } from 'tdesign-icons-vue-next'
import { useGroupChat } from './useGroupChat'
import { confirmClearLog, confirmClearCache } from './components/GroupChatClearDialog'
import GroupChatContextBar from './components/GroupChatContextBar.vue'
import GroupChatMembers from './components/GroupChatMembers.vue'
import GroupChatMessageList from './components/GroupChatMessageList.vue'
import GroupChatSender from './components/GroupChatSender.vue'

const {
  discussion,
  chat,
  loading,
  running,
  compressing,
  orderedRoles,
  messageListRef,
  send,
  newContext,
  compressContext,
  stop,
  clearLogically,
  clearCompletely,
  updateExpiryHours
} = useGroupChat()

const asideVisible = ref(false)

const asideWidth = computed(() => (asideVisible.value ? '320px' : '0px'))

const memberCount = computed(() => discussion.value?.roles?.length ?? 0)
</script>

<style scoped lang="less">
.group-chat,
.group-chat__loading {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.group-chat__loading {
  align-items: center;
  justify-content: center;
}

.group-chat {
  background: var(--td-bg-color-page);
}

.group-chat__header {
  height: auto;
  padding: var(--td-comp-margin-m) var(--td-comp-margin-l);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--td-comp-margin-m);
  flex-wrap: wrap;
  border-bottom: 1px solid var(--td-component-border);
}

.group-chat__title {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.group-chat__name {
  color: var(--td-text-color-primary);
  font: var(--td-font-title-medium);
}

.group-chat__desc {
  color: var(--td-text-color-secondary);
  font: var(--td-font-body-small);
}

.group-chat__header-actions {
  display: flex;
  align-items: center;
  gap: var(--td-comp-margin-s);
}

.group-chat__body {
  min-height: 0;
}

.group-chat__content {
  display: flex;
  flex-direction: column;
  min-height: 0;
  position: relative;
}

.group-chat__footer {
  margin: 0 var(--td-comp-margin-l) var(--td-comp-margin-m);
  flex: 0 0 auto;
}

.group-chat__aside {
  border-left: 1px solid var(--td-component-border);
  background: var(--td-bg-color-container);
  overflow-y: auto;
  transition: width 0.2s ease;

  &.is-collapsed {
    border-left: none;
    overflow: hidden;
    padding-left: 0;
    padding-right: 0;
  }
}
</style>
