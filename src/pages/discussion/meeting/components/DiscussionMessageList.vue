<template>
  <div ref="listRef" class="message-list">
    <t-empty
      v-if="messages.length === 0"
      title="从一个议题开始"
      description="固定角色会按预设流程依次发言，形成可控的深度讨论。"
    />
    <article
      v-for="message in messages"
      :key="message.id"
      :class="['message-card', `message-card--${message.type}`]"
    >
      <div class="message-card__avatar">
        <t-avatar size="32px" shape="round">{{ getAvatar(message) }}</t-avatar>
      </div>
      <div class="message-card__body">
        <div class="message-card__meta">
          <span class="message-card__speaker">{{ getSpeaker(message) }}</span>
          <span class="message-card__round">第 {{ message.round }} 轮</span>
          <t-tag v-if="message.status && message.status !== 'complete'" size="small" variant="light">
            {{ getStatusText(message.status) }}
          </t-tag>
          <t-button
            class="message-card__delete"
            theme="danger"
            variant="text"
            shape="square"
            size="small"
            @click="emit('delete', message.id)"
          >
            <template #icon><delete-icon /></template>
          </t-button>
        </div>
        <ChatContent v-if="message.content" :content="message.content" />
        <div v-else-if="message.status === 'stop'" class="message-card__pending">
          <span>已停止</span>
        </div>
        <div v-else-if="message.status === 'error'" class="message-card__pending">
          <span>生成异常</span>
        </div>
        <div v-else class="message-card__pending">
          <t-loading size="small" />
          <span>正在组织观点...</span>
        </div>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { ChatContent } from '@tdesign-vue-next/chat'
import { DeleteIcon } from 'tdesign-icons-vue-next'
import type { AiAgent } from '@/entity/ai'
import type {
  AiDiscussionMessage,
  AiDiscussionMessageStatus,
} from '@/entity/ai'
import { useAiAgentStore } from '@/store'

const props = defineProps<{
  messages: AiDiscussionMessage[]
  roles: string[]
  summaryRole?: string
}>()

const emit = defineEmits<{
  delete: [messageId: string]
}>()

const listRef = ref<HTMLElement>()

const aiAgentStore = useAiAgentStore()
const roleMap = computed(() => {
  const map = new Map<string, AiAgent>()
  const agents = aiAgentStore.state
  props.roles.forEach((id) => {
    const agent = agents.find((a) => a.id === id)
    if (agent) map.set(agent.id, agent)
  })
  if (props.summaryRole) {
    const agent = agents.find((a) => a.id === props.summaryRole)
    if (agent) map.set(agent.id, agent)
  }
  return map
})

const getRole = (message: AiDiscussionMessage) =>
  message.roleId ? roleMap.value.get(message.roleId) : undefined

const getSpeaker = (message: AiDiscussionMessage) => {
  if (message.type === 'user') return '你'
  if (message.type === 'summary') return `总结 · ${getRole(message)?.name || '总结者'}`
  return getRole(message)?.name || '未知角色'
}

const getAvatar = (message: AiDiscussionMessage) => getSpeaker(message).slice(0, 1)

const getStatusText = (status: AiDiscussionMessageStatus) => {
  if (status === 'pending') return '等待中'
  if (status === 'streaming') return '输出中'
  if (status === 'stop') return '已停止'
  if (status === 'error') return '异常'
  return '完成'
}

const scrollToBottom = () => {
  requestAnimationFrame(() => {
    const target = listRef.value
    if (target) target.scrollTop = target.scrollHeight
  })
}

watch(() => props.messages.length, scrollToBottom)
watch(() => props.messages.at(-1)?.content, scrollToBottom)

defineExpose({ scrollToBottom })
</script>

<style scoped lang="less">
.message-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--td-comp-margin-l);
  min-height: 0;
  padding: var(--td-comp-paddingTB-l) var(--td-comp-paddingLR-xl);
  overflow: auto;
}

.message-card {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  gap: var(--td-comp-margin-s);
  max-width: 920px;
  animation: message-enter var(--fluent-transition-normal) ease-out;
}

.message-card--user {
  align-self: flex-end;
  max-width: 760px;
}

.message-card--summary {
  max-width: 980px;
}

.message-card__body {
  min-width: 0;
  padding: var(--td-comp-paddingTB-m) var(--td-comp-paddingLR-l);
  border: 1px solid var(--fluent-card-border);
  border-radius: var(--fluent-radius-card);
  background: var(--fluent-card-bg);
  box-shadow: var(--fluent-card-shadow);
}

.message-card--user .message-card__body {
  background: var(--td-brand-color-light);
  border-color: var(--td-brand-color-focus);
}

.message-card--summary .message-card__body {
  background: var(--td-success-color-light);
  border-color: var(--td-success-color-focus);
}

.message-card__meta,
.message-card__pending {
  display: flex;
  align-items: center;
  gap: var(--td-comp-margin-s);
}

.message-card__meta {
  margin-bottom: var(--td-comp-margin-xs);
}

.message-card__delete {
  margin-left: auto;
  opacity: 0;
  transition: opacity var(--fluent-transition-fast);
}

.message-card__body:hover .message-card__delete {
  opacity: 0.6;
}

.message-card__body:hover .message-card__delete:hover {
  opacity: 1;
}

.message-card__speaker {
  color: var(--td-text-color-primary);
  font-weight: 600;
}

.message-card__round,
.message-card__pending {
  color: var(--td-text-color-secondary);
  font: var(--td-font-body-small);
}

@keyframes message-enter {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 820px) {
  .message-list {
    padding: var(--td-comp-paddingTB-m) var(--td-comp-paddingLR-m);
  }

  .message-card,
  .message-card--user,
  .message-card--summary {
    width: 100%;
    max-width: none;
  }
}
</style>
