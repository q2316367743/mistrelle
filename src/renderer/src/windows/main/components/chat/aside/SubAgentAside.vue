<template>
  <div class="sub-agent-aside">
    <div class="sub-agent-aside__header">
      <span class="sub-agent-aside__status">
        <span v-if="subAgent.status === 'running'" class="status-dot" aria-hidden="true" />
        <CheckCircleIcon v-else-if="subAgent.status === 'completed'" class="status-check" />
        <ErrorCircleIcon v-else class="status-error" />
      </span>
      <span class="sub-agent-aside__title ellipsis" :title="subAgent.task || '子 Agent'">
        {{ subAgent.task || '（无任务摘要）' }}
      </span>
      <t-button theme="default" variant="text" shape="square" size="small" @click="emit('close')">
        <template #icon><CloseIcon /></template>
      </t-button>
    </div>
    <div class="sub-agent-aside__body">
      <sub-agent-session :messages="messages" :running="subAgent.status === 'running'" />
    </div>
  </div>
</template>
<script lang="ts" setup>
import { CheckCircleIcon, CloseIcon, ErrorCircleIcon } from 'tdesign-icons-vue-next'
import type { ChatMessage } from '@/domain'
import type { SubAgentInfo } from '@/windows/main/modules/chat/agent/agentMessages'
import SubAgentSession from './SubAgentSession.vue'

defineProps<{
  subAgent: SubAgentInfo
  messages: ChatMessage[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()
</script>
<style scoped lang="less">
.sub-agent-aside {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 8px;

  &__header {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--td-border-level-1-color);
  }

  &__status {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 18px;
    height: 18px;
  }

  &__title {
    flex: 1;
    min-width: 0;
    font: var(--td-font-body-medium);
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  &__body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding-top: 8px;
  }
}

// 运行中的脉冲指示点（Fluent live indicator）
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--td-radius-circle);
  background: var(--td-brand-color);
  animation: fluent-pulse 1.1s ease-in-out infinite;
}

@keyframes fluent-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.35;
    transform: scale(0.75);
  }
}

.status-check {
  color: var(--td-success-color);
  font-size: var(--td-font-size-body-large);
}

.status-error {
  color: var(--td-error-color);
  font-size: var(--td-font-size-body-large);
}
</style>
