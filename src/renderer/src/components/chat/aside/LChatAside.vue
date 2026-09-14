<template>
  <sub-agent-aside
    v-if="subAgent"
    :sub-agent="subAgent"
    :messages="subAgentMessages"
    @close="$emit('close-sub-agent')"
  />
  <office-aside
    v-else-if="type === 'office'"
    :messages="messages"
    :workspace="workspace"
    :sandbox="sandbox"
    :todos="todos"
    :agent-history="agentHistory"
    :active-agent-id="activeAgentId"
    @view-agent="$emit('view-agent', $event)"
  />
  <writing-aside
    v-else-if="type === 'writing'"
    :sandbox="sandbox"
    :workspace="workspace"
    :writing-scene="writingScene"
    :fullscreen="fullscreen"
  />
  <html-design-aside
    v-else-if="type === 'design' && designScene === 'html'"
    :sandbox="sandbox"
    :workspace="workspace"
    :fullscreen="fullscreen"
    :status="status"
  />
  <design-aside
    v-else-if="type === 'design'"
    :sandbox="sandbox"
    :workspace="workspace"
    :fullscreen="fullscreen"
    :status="status"
  />
</template>
<script lang="ts" setup>
import type { ChatMessage, TodoItem } from '@/domain'
import type { ChatStatus, ChatType, DesignScene, WritingScene } from '@/windows/main/modules/chat'
import type { AgentHistoryItem } from '@/components/chat/AgentHistoryList.vue'
import type { SubAgentInfo } from '@/windows/main/modules/chat/agent/agentMessages'
import OfficeAside from './OfficeAside.vue'
import SubAgentAside from './SubAgentAside.vue'
import WritingAside from './writing/WritingAside.vue'
import DesignAside from './design/DesignAside.vue'
import HtmlDesignAside from './design/HtmlDesignAside.vue'

withDefaults(
  defineProps<{
    type: ChatType
    writingScene?: WritingScene
    designScene?: DesignScene
    messages: ChatMessage[]
    workspace?: string
    sandbox?: string
    status: ChatStatus
    todos: TodoItem[]
    agentHistory: AgentHistoryItem[]
    activeAgentId: string
    /** 正在侧栏查看的子 Agent；给出时优先渲染子 Agent 面板，隐藏原会话面板 */
    subAgent?: SubAgentInfo
    /** 子 Agent 面板展示的消息（运行中实时 / 已完成磁盘快照） */
    subAgentMessages?: ChatMessage[]
    fullscreen?: boolean
  }>(),
  {
    type: 'office',
    writingScene: 'article',
    designScene: 'canvas',
    messages: () => [],
    workspace: '',
    sandbox: '',
    status: 'idle',
    todos: () => [],
    agentHistory: () => [],
    activeAgentId: 'main',
    subAgentMessages: () => [],
    fullscreen: false
  }
)

defineEmits<{
  (e: 'view-agent', subAgentId: string): void
  (e: 'close-sub-agent'): void
}>()
</script>
