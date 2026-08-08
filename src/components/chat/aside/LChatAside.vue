<template>
  <office-aside
    v-if="type === 'office'"
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
  <design-aside v-else-if="type === 'design'" :sandbox="sandbox" :fullscreen="fullscreen" />
</template>
<script lang="ts" setup>
import type { ChatMessage, TodoItem } from '@/domain'
import type { ChatType, WritingScene } from '@/modules/chat'
import type { AgentHistoryItem } from '@/components/chat/AgentHistoryList.vue'
import OfficeAside from './OfficeAside.vue'
import WritingAside from './writing/WritingAside.vue'
import DesignAside from './design/DesignAside.vue'

withDefaults(
  defineProps<{
    type: ChatType
    writingScene?: WritingScene
    messages: ChatMessage[]
    workspace?: string
    sandbox?: string
    todos: TodoItem[]
    agentHistory: AgentHistoryItem[]
    activeAgentId: string
    fullscreen?: boolean
  }>(),
  {
    type: 'office',
    writingScene: 'article',
    messages: () => [],
    workspace: '',
    sandbox: '',
    todos: () => [],
    agentHistory: () => [],
    activeAgentId: 'main',
    fullscreen: false
  }
)

defineEmits<{
  (e: 'view-agent', subAgentId: string): void
}>()
</script>
