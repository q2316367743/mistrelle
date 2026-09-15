<template>
  <ChatThinking
    class="my-4px"
    :collapsed="collapsed"
    :content="content.data"
    :status="content.status || 'pending'"
    @collapsed-change="toggleCollapsed()"
  />
</template>
<script lang="ts" setup>
import { ThinkingContent, ChatThinking } from '@tdesign-vue-next/chat'
import { useBoolState } from '@/hooks'
defineProps({
  content: {
    type: Object as PropType<ThinkingContent>,
    default: () => ({})
  }
})
// 思考块一律默认折叠（含流式中正在思考的块），思考过程由用户按需点击展开
const [collapsed, toggleCollapsed] = useBoolState(true)
</script>
<style scoped lang="less"></style>
