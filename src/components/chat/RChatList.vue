<template>
  <div class="r-chat-list">
    <ChatList
      :clear-history="clearHistory"
      :text-loading="textLoading"
      :is-stream-load="isStreamLoad"
      animation="gradient"
      class="r-chat-list__content"
      @clear="emit('clear')"
    >
      <div class="px-8px">
        <ChatMessage
          v-for="message in messages"
          :key="message.id"
          class="r-chat-list__item"
          :data-message-id="message.id"
          :role="message.role"
          :placement="message.role === 'user' ? 'right' : 'left'"
          :variant="message.role === 'user' ? 'base' : 'text'"
        >
          <template #content>
            <div class="flex flex-col gap-4px">
              <r-chat-system v-if="message.role === 'system'" :prompt="message.content[0]?.data" />
              <template v-else-if="message.role === 'user'">
                <ChatMessage variant="outline" placement="right" :role="message.role">
                  <template #content>
                    <!-- 用户消息内联展示：文本为文字，skill/file 为不同色与图标的标签，整行内联 -->
                    <div class="r-chat-list__user-content">
                      <template v-for="(item, index) in message.content" :key="item.id || index">
                        <span v-if="item.type === 'text'" class="r-chat-list__text">{{
                          item.data
                        }}</span>
                        <t-tag
                          v-else-if="item.type === 'skill'"
                          theme="primary"
                          variant="light"
                          :title="item.data.path"
                          size="small"
                          class="r-chat-list__inline-tag mr-4px"
                        >
                          <template #icon><CodeIcon /></template>
                          {{ item.data.name }}
                        </t-tag>
                        <template v-else-if="item.type === 'attachment'">
                          <t-tag
                            v-for="(file, fi) in item.data"
                            :key="file.url || fi"
                            theme="success"
                            variant="light"
                            :title="file.url"
                            class="r-chat-list__inline-tag"
                          >
                            <template #icon><FileIcon /></template>
                            @{{ file.name }}
                          </t-tag>
                        </template>
                      </template>
                    </div>
                  </template>
                  <template #actionbar>
                    <RChatActionbar
                      :content="getUserText(message)"
                      role="user"
                      @reask="emit('reask', message.id)"
                      @rollback="emit('rollback', message.id)"
                    />
                  </template>
                </ChatMessage>
              </template>
              <template v-else>
                <template
                  v-for="(contentItem, contentIndex) in message.content"
                  :key="contentItem.id || contentIndex"
                >
                  <ChatContent
                    v-if="contentItem.type === 'text' || contentItem.type === 'markdown'"
                    :content="contentItem.data"
                  />
                  <r-chat-think
                    v-else-if="contentItem.type === 'thinking'"
                    :content="contentItem"
                    :index="contentIndex"
                  />
                  <r-chat-tool v-else-if="contentItem.type === 'toolcall'" :content="contentItem" />
                </template>
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
      <t-tooltip
        v-for="message in messages"
        :key="message.id"
        content="定位到这条消息"
        placement="left"
      >
        <t-button
          :class="['r-chat-list__locator', `r-chat-list__locator--${message.role}`]"
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
import { CodeIcon, FileIcon } from 'tdesign-icons-vue-next'
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
  },
  textLoading: {
    type: Boolean,
    default: false
  },
  isStreamLoad: {
    type: Boolean,
    default: false
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
  return (
    message.content?.find((item) => item.type === 'markdown' || item.type === 'text')?.data ?? ''
  )
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

// 用户消息内容：文本与标签像一段文字内联排列，自然换行
.r-chat-list__user-content {
  display: block;
  line-height: 22px;
  border: 1px solid var(--td-border-level-1-color);
  padding: 8px;
  border-radius: var(--td-radius-large);
}

.r-chat-list__text {
  white-space: pre-wrap;
  word-break: break-word;
}

.r-chat-list__locator-group {
  position: absolute;
  top: 0;
  right: -8px;
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
  width: 18px;
  height: 2px;
  border-radius: var(--td-radius-round);
  background: currentcolor;
  transition: width 160ms ease;
}

.r-chat-list__locator:hover .r-chat-list__locator-line {
  width: 32px;
}
</style>
