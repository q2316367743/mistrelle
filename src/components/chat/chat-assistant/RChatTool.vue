<template>
  <div class="chat-tool-wrapper">
    <ask-chat-tool v-if="isAskTool" :content="content" />
    <confirm-chat-tool v-else-if="isConfirmPending" :content="content" />
    <file-chat-tool v-else-if="isFileTool" :content="content" />
    <shell-chat-tool v-else-if="isShellTool" :content="content" />
    <skill-chat-tool v-else-if="isSkillTool" :content="content" />
    <default-chat-tool v-else-if="!isTodoTool" :content="content" />
  </div>
</template>
<script lang="ts" setup>
import { computed } from 'vue'
import type { ToolCallContent } from '@tdesign-vue-next/chat'
import AskChatTool from '@/components/chat/chat-assistant/tool/AskChatTool.vue'
import ConfirmChatTool from '@/components/chat/chat-assistant/tool/ConfirmChatTool.vue'
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
const askToolName = 'ask'

const toolCallName = computed(() => props.content.data.toolCallName)

const isAskTool = computed(() => toolCallName.value === askToolName)
// 仅 pending 态接入 confirm 卡片；决策完成（complete）后回落到各工具自有渲染展示结果
const isConfirmPending = computed(
  () => props.content.ext?.interactive === 'confirm' && props.content.status === 'pending'
)
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
