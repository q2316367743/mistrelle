<template>
  <ChatThinking
    :collapsed="collapsed"
    :content="content.data"
    :status="content.status || 'pending'"
    @collapsed-change="toggleCollapsed()"
  />
</template>
<script lang="ts" setup>
import { ThinkingContent, ChatThinking } from '@tdesign-vue-next/chat'
import { useBoolState } from '@/hooks'
const props = defineProps({
  content: {
    type: Object as PropType<ThinkingContent>,
    default: () => ({})
  },
  index: Number
})
const [collapsed, toggleCollapsed] = useBoolState(props.index !== 0)
watch(
  () => props.content.status,
  (val) => {
    if (val === 'complete') {
      collapsed.value = true
    }
  },
  { immediate: true }
)
</script>
<style scoped lang="less"></style>
