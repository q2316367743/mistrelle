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
  </div>
</template>
<script lang="ts" setup>
import { AIMessage } from '@/domain'
import RChatTool from '@/components/chat/chat-assistant/RChatTool.vue'
import { ChatContent } from '@tdesign-vue-next/chat'

defineProps({
  message: {
    type: Object as PropType<AIMessage>,
    required: true
  }
})
</script>
<style scoped lang="less"></style>
