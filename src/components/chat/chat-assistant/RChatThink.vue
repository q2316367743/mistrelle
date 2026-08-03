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
  /** 是否为当前正在思考的块：初始展开显示思考过程，思考完成（status 变 complete）后自动折叠 */
  active: {
    type: Boolean,
    default: false
  }
})
// 初始折叠状态：仅当前正在思考的块展开，其余（已完成）的块默认折叠
const [collapsed, toggleCollapsed] = useBoolState(!props.active)
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
