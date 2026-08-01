<template>
  <div class="chat-tool-wrapper">
    <file-chat-tool v-if="isFileTool" :content="content" />
    <shell-chat-tool v-else-if="isShellTool" :content="content" />
    <skill-chat-tool v-else-if="isSkillTool" :content="content" />
    <default-chat-tool v-else-if="!isTodoTool" :content="content" />
  </div>
</template>
<script lang="ts" setup>
import { computed } from 'vue'
import type { ToolCallContent } from '@tdesign-vue-next/chat'
import DefaultChatTool from '@/components/chat/chat-assistant/tool/DefaultChatTool.vue'
import FileChatTool from '@/components/chat/chat-assistant/tool/FileChatTool.vue'
import ShellChatTool from '@/components/chat/chat-assistant/tool/ShellChatTool.vue'
import SkillChatTool from '@/components/chat/chat-assistant/tool/SkillChatTool.vue'

const props = defineProps({
  content: {
    type: Object as PropType<ToolCallContent>,
    required: true
  }
})

const shellToolNames = new Set(['cli_run', 'js_run', 'python_run', 'node_run', 'git_exec'])
const skillToolNames = new Set(['load_skill', 'read_skill_file'])
const todoToolName = 'update_todo'

const toolCallName = computed(() => props.content.data.toolCallName)

const isFileTool = computed(() => toolCallName.value.startsWith('file_'))
const isShellTool = computed(() => shellToolNames.has(toolCallName.value))
const isSkillTool = computed(() => skillToolNames.has(toolCallName.value))
// 待办工具调用不占用消息流（状态由侧栏 TodoList 呈现），整体隐藏
const isTodoTool = computed(() => toolCallName.value === todoToolName)
</script>
<style scoped lang="less">
.chat-tool-wrapper {
  display: contents;
}
</style>
