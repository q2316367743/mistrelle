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
          :class="['r-chat-list__item', message.role]"
          :data-message-id="message.id"
          :role="message.role"
          :placement="message.role === 'user' ? 'right' : 'left'"
          :variant="message.role === 'user' ? 'base' : 'text'"
        >
          <template #content>
            <m-chat-user
              v-if="message.role === 'user'"
              :message="message"
              @delete="emit('delete', $event)"
            />
            <m-chat-assistant
              v-else-if="message.role === 'assistant'"
              :message="message"
              :status="status"
              @continue="emit('continue', $event)"
              @view-sub-agent="emit('view-sub-agent', $event)"
            />
          </template>
        </ChatMessage>
      </div>
    </ChatList>
    <div class="r-chat-list__locator-group">
      <t-tooltip
        v-for="message in userMessages"
        :key="message.id"
        :content="getLocatorTooltip(message)"
        placement="left"
      >
        <t-button
          class="r-chat-list__locator r-chat-list__locator--user"
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
import { ChatList, ChatMessage } from '@tdesign-vue-next/chat'
import { ChatMessage as ChatMessageType, ChatStatus, UserMessage } from '@/domain'
import type { PropType } from 'vue'

const props = defineProps({
  clearHistory: {
    type: Boolean,
    default: false
  },
  messages: {
    type: Array as PropType<Array<ChatMessageType>>,
    default: () => []
  },
  status: {
    type: String as PropType<ChatStatus>,
    required: true
  }
})
const emit = defineEmits<{
  clear: []
  delete: [messageId: string]
  change: []
  continue: [messageId: string]
  'view-sub-agent': [subAgentId: string]
}>()

const textLoading = computed(() => props.status === 'pending')
const isStreamLoad = computed(() => props.status === 'streaming')

const userMessages = computed(() =>
  props.messages.filter((message): message is UserMessage => message.role === 'user')
)

const LOCATOR_TEXT_MAX = 10

const getLocatorTooltip = (message: UserMessage) => {
  const fallback = message.content
    .map((item) => {
      if (item.type === 'skill') return item.data.name
      if (item.type === 'tool') return item.data.label
      if (item.type === 'canvas') return `画布(canvas-${item.data.version})节点(${item.data.label || item.data.nodeId})`
      if (item.type === 'attachment') return item.data.map((file) => file.name ?? '').join(', ')
      return ''
    })
    .filter(Boolean)
    .join(', ')
  const text = message.content.find((item) => item.type === 'text')?.data || fallback

  return text.length > LOCATOR_TEXT_MAX ? `${text.slice(0, LOCATOR_TEXT_MAX)}…` : text
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
  width: 100%;
}

.r-chat-list__content {
  flex: 1;
  min-height: 0;
}

.r-chat-list__item {
  scroll-margin-top: var(--td-comp-margin-xxl);
  max-width: 1080px;
  &.user {
    margin-left: auto;
  }
}

.r-chat-list__locator-group {
  position: absolute;
  top: 56px;
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
