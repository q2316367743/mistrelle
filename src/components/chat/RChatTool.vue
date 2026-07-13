<template>
  <div class="chat-tool">
    <default-chat-tool :content="content" />
  </div>
</template>
<script lang="ts" setup>
import type { ToolCallContent } from '@tdesign-vue-next/chat'
import DefaultChatTool from '@/components/chat/tool/DefaultChatTool.vue'

defineProps({
  content: {
    type: Object as PropType<ToolCallContent>,
    required: true
  }
})
</script>
<style scoped lang="less"></style>
