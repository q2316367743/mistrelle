<template>
  <div class="r-chat-list">
    <ChatList :clear-history="clearHistory" class="r-chat-list__content" @clear="emit('clear')">
      <div class="px-8px">
        <ChatMessage
          v-for="message in messages"
          :key="message.id"
          class="r-chat-list__item"
          :data-message-id="message.id"
          :message="message"
          :placement="message.role === 'user' ? 'right' : 'left'"
          :variant="message.role === 'user' ? 'base' : 'text'"
        >
          <template #content>
            <div class="flex flex-col gap-4px">
              <template
                v-for="(contentItem, contentIndex) in message.content"
                :key="contentItem.id || contentIndex"
              >
                <r-chat-system v-if="message.role === 'system'" :prompt="message.content[0]?.data" />
                <ChatMessage
                  v-else-if="message.role === 'user'"
                  variant="outline"
                  placement="right"
                  :content="message.content"
                  :role="message.role"
                >
                  <template #actionbar>
                    <RChatActionbar
                      :content="getUserText(message)"
                      role="user"
                      @reask="emit('reask', message.id)"
                      @rollback="emit('rollback', message.id)"
                    />
                  </template>
                </ChatMessage>
                <ChatContent
                  v-else-if="contentItem.type === 'text' || contentItem.type === 'markdown'"
                  :content="contentItem.data"
                />
                <r-chat-think
                  v-else-if="contentItem.type === 'thinking'"
                  :content="contentItem"
                  :index="contentIndex"
                />
                <r-chat-tool v-else-if="contentItem.type === 'toolcall'" :content="contentItem" />
              </template>
            </div>
          </template>
          <template #actionbar>
            <RChatActionbar
              v-if="message.role === 'assistant'"
              role="assistant"
              :comment="message.comment"
              :content="getAssistantText(message)"
              @comment-change="handleCommentChange(message, $event)"
            />
          </template>
        </ChatMessage>
      </div>
    </ChatList>
    <div class="r-chat-list__locator-group">
      <t-tooltip v-for="message in messages" :key="message.id" content="定位到这条消息" placement="left">
        <t-button
          :class="[
            'r-chat-list__locator',
            `r-chat-list__locator--${message.role}`
          ]"
          variant="text"
          shape="square"
          size="small"
          :aria-label="`定位到消息 ${message.id}`"
          @click="scrollToMessage(message.id)"
        >
          <span class="r-chat-list__locator-line" />
        </t-button>
      </t-tooltip>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { ChatContent, ChatList, ChatMessage } from '@tdesign-vue-next/chat'
import type { AIMessage, ChatComment, ChatMessage as ChatMessageType, UserMessage } from '@/domain'
import RChatTool from '@/components/chat/RChatTool.vue'
import RChatSystem from '@/components/chat/RChatSystem.vue'
import RChatActionbar from '@/components/chat/RChatActionbar.vue'

defineProps({
  clearHistory: {
    type: Boolean,
    default: false
  },
  messages: {
    type: Array as PropType<Array<ChatMessageType>>,
    default: () => []
  }
})
const emit = defineEmits<{
  clear: []
  reask: [messageId: string]
  rollback: [messageId: string]
  change: []
}>()

const getUserText = (message: UserMessage) => {
  return message.content.find((item) => item.type === 'text')?.data ?? ''
}

const getAssistantText = (message: AIMessage) => {
  return message.content?.find((item) => item.type === 'markdown' || item.type === 'text')?.data ?? ''
}

const handleCommentChange = (message: AIMessage, comment: ChatComment) => {
  message.comment = comment
  emit('change')
}

const scrollToMessage = (messageId: string) => {
  const target = document.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(messageId)}"]`)

  target?.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  })
}
</script>
<style scoped lang="less">
.r-chat-list {
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding-bottom: 8px;
}

.r-chat-list__content {
  flex: 1;
  min-height: 0;
}

.r-chat-list__item {
  scroll-margin-top: var(--td-comp-margin-xxl);
}

.r-chat-list__locator-group {
  position: absolute;
  top: var(--td-comp-margin-m);
  right: var(--td-comp-margin-xs);
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
  max-height: calc(100% - var(--td-comp-margin-m) * 2);
  overflow: auto;
}

.r-chat-list__locator {
  width: 36px;
  height: 14px;
  color: var(--td-text-color-placeholder);
  opacity: 0.58;
  transition:
    color 160ms ease,
    opacity 160ms ease;
}

.r-chat-list__locator--user {
  color: var(--td-brand-color);
}

.r-chat-list__locator--assistant {
  color: var(--td-success-color);
}

.r-chat-list__locator:hover {
  opacity: 1;
}

.r-chat-list__locator-line {
  display: block;
  width: 14px;
  height: 2px;
  border-radius: var(--td-radius-round);
  background: currentcolor;
  transition: width 160ms ease;
}

.r-chat-list__locator:hover .r-chat-list__locator-line {
  width: 28px;
}
</style>
