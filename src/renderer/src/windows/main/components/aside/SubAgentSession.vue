<template>
  <div class="sub-agent-session">
    <div v-if="!messages.length" class="sub-agent-session__empty">
      <t-loading v-if="running" size="small" />
      <span>{{ running ? '子 Agent 执行中…' : '暂无执行记录' }}</span>
    </div>
    <template v-for="message in messages" :key="message.id">
      <div v-if="message.role === 'user'" class="sub-agent-session__task">
        <span class="sub-agent-session__task-label">任务</span>
        <span class="sub-agent-session__task-text">{{ userText(message) }}</span>
      </div>
      <template v-else>
        <template
          v-for="(contentItem, contentIndex) in message.content ?? []"
          :key="contentItem.id || contentIndex"
        >
          <ChatContent
            v-if="contentItem.type === 'text' || contentItem.type === 'markdown'"
            class="sub-agent-session__text"
            :content="contentItem.data"
          />
          <r-chat-think
            v-else-if="contentItem.type === 'thinking'"
            :content="contentItem"
          />
          <default-chat-tool
            v-else-if="contentItem.type === 'toolcall'"
            :content="contentItem"
          />
          <r-chat-image v-else-if="contentItem.type === 'image'" :content="contentItem" />
        </template>
      </template>
    </template>
  </div>
</template>
<script lang="ts" setup>
import { ChatContent } from '@tdesign-vue-next/chat'
import type { ChatMessage } from '@/domain'
import RChatThink from '@/windows/main/components/chat-assistant/RChatThink.vue'
import RChatImage from '@/windows/main/components/chat-assistant/RChatImage.vue'
import DefaultChatTool from '@/windows/main/components/chat-assistant/tool/DefaultChatTool.vue'

defineProps<{
  messages: ChatMessage[]
  /** 子 Agent 是否运行中（决定空态文案） */
  running?: boolean
}>()

const userText = (message: ChatMessage) => {
  if (message.role !== 'user') return ''
  return message.content.find((item) => item.type === 'text')?.data ?? ''
}
</script>
<style scoped lang="less">
.sub-agent-session {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__empty {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 4px;
    color: var(--td-text-color-placeholder);
    font: var(--td-font-body-small);
  }

  // 任务消息：与执行过程区分开的浅色块
  &__task {
    padding: 8px;
    border-radius: var(--td-radius-medium);
    background: var(--td-bg-color-secondarycontainer);
    font: var(--td-font-body-small);
  }

  &__task-label {
    display: inline-block;
    margin-right: 6px;
    color: var(--td-text-color-placeholder);
  }

  &__task-text {
    color: var(--td-text-color-secondary);
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }

  &__text {
    font: var(--td-font-body-small);
    color: var(--td-text-color-primary);
  }
}
</style>
