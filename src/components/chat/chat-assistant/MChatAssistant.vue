<template>
  <div class="chat-assistant">
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
    <FileProductList :message="message" />
    <RChatActionbar
      role="assistant"
      class="mt-8px"
      :comment="message.comment"
      :content="getAssistantText(message)"
      @comment-change="handleCommentChange(message, $event)"
    />
  </div>
</template>
<script lang="ts" setup>
import { AIMessage, type ChatComment } from '@/domain'
import RChatTool from '@/components/chat/chat-assistant/RChatTool.vue'
import FileProductList from '@/components/chat/chat-assistant/FileProductList.vue'
import { ChatContent } from '@tdesign-vue-next/chat'
import RChatActionbar from '@/components/chat/RChatActionbar.vue'

defineProps({
  message: {
    type: Object as PropType<AIMessage>,
    required: true
  }
})

const emit = defineEmits(['change'])

const getAssistantText = (message: AIMessage) => {
  return (
    message.content?.find((item) => item.type === 'markdown' || item.type === 'text')?.data ?? ''
  )
}

const handleCommentChange = (message: AIMessage, comment: ChatComment) => {
  message.comment = comment
  emit('change')
}
</script>
<style scoped lang="less"></style>
