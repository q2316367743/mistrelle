<template>
  <ChatList :clear-history="clearHistory" style="flex: 1" @clear="$emit('clear')">
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
                <ChatActionbar
                  :content="message.content[0].data as string"
                  :action-bar="['replay', 'copy']"
                  @actions="handleUserAction($event, message)"
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
        <ChatActionbar
          v-if="message.role === 'assistant'"
          :comment="message.comment"
          :content="message.content?.find((e) => e.type === 'markdown')?.data"
          :action-bar="['good', 'bad', 'copy', 'share']"
        />
      </template>
    </ChatMessage>
  </ChatList>
</template>
<script lang="ts" setup>
import { ChatActionbar, ChatContent, ChatList, ChatMessage } from '@tdesign-vue-next/chat'
import { ChatMessage as ChatMessageType, UserMessage } from '@/domain'
import RChatTool from '@/components/chat/RChatTool.vue'
import RChatSystem from '@/components/chat/RChatSystem.vue'
import { copyText } from '@/utils/native'

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
const emit = defineEmits(['clear', 'reask'])

const handleUserAction = (value: string, message: UserMessage) => {
  console.log('handleUserAction', value, message)
  if (value === 'replay') {
    emit('reask', message.id)
  } else if (value === 'copy') {
    const text = message.content[0]?.data as string
    if (text) {
      copyText(text)
    }
  }
}
</script>
<style scoped lang="less"></style>
