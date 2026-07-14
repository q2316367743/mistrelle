<template>
  <ChatList :clear-history="clearHistory" style="flex: 1" @clear="emit('clear')">
    <div class="px-8px">
      <ChatMessage
        v-for="message in messages"
        :key="message.id"
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
</script>
<style scoped lang="less"></style>
