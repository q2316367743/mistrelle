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
  />
  <design-aside v-else-if="type === 'design'" :sandbox="sandbox" />
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
  }>(),
  {
    type: 'office',
    writingScene: 'free',
    messages: () => [],
    workspace: '',
    sandbox: '',
    todos: () => [],
    agentHistory: () => [],
    activeAgentId: 'main'
  }
)

defineEmits<{
  (e: 'view-agent', subAgentId: string): void
}>()
</script>
