<template>
  <div class="agent-panel">
    <!-- 主 Agent 常驻顶部，提供返回主对话的入口 -->
    <div
      class="agent-item"
      :class="{ active: activeId === 'main' }"
      @click="$emit('view-agent', 'main')"
    >
      <span class="agent-status">
        <UserIcon class="agent-icon agent-icon--main" />
      </span>
      <span class="agent-main">
        <span class="agent-task">主 Agent</span>
        <span class="agent-meta">当前对话</span>
      </span>
    </div>

    <template v-for="group in groups" :key="group.messageIndex">
      <t-divider />
      <div class="agent-group">
        <div class="agent-group__title">
          <t-tag v-if="group.current" size="small" theme="primary" variant="light">当前</t-tag>
          <span class="agent-group__round">第 {{ group.messageIndex + 1 }} 轮</span>
        </div>
        <div
          v-for="item in group.items"
          :key="item.subId"
          class="agent-item"
          :class="{ active: item.subId === activeId }"
          @click="$emit('view-agent', item.subId)"
        >
          <span class="agent-status">
            <span v-if="item.status === 'running'" class="status-dot" aria-hidden="true" />
            <CheckCircleIcon v-else-if="item.status === 'completed'" class="agent-icon agent-icon--success" />
            <ErrorCircleIcon v-else-if="item.status === 'error'" class="agent-icon agent-icon--error" />
            <UserIcon v-else class="agent-icon agent-icon--default" />
          </span>
          <span class="agent-main">
            <span class="agent-task ellipsis">{{ item.task || '（无任务摘要）' }}</span>
          </span>
        </div>
      </div>
    </template>
  </div>
</template>
<script lang="ts" setup>
import type { SubAgentInfo } from '@/modules/chat/agent/agentMessages'
import { CheckCircleIcon, ErrorCircleIcon, UserIcon } from 'tdesign-icons-vue-next'

/** 侧边栏「Agent 面板」条目：子 Agent 汇总 + 是否当前轮 */
export type AgentHistoryItem = SubAgentInfo & { current: boolean }

const props = defineProps<{
  items: AgentHistoryItem[]
  activeId: string
}>()

defineEmits<{
  (e: 'view-agent', subAgentId: string): void
}>()

/** 按所属消息分组（顺序与 messages 一致），同组内的子 Agent 保持 spawn 顺序 */
const groups = computed(() => {
  const map = new Map<number, AgentHistoryItem[]>()
  props.items.forEach((item) => {
    const list = map.get(item.messageIndex) ?? []
    list.push(item)
    map.set(item.messageIndex, list)
  })
  return Array.from(map.entries()).map(([messageIndex, items]) => ({
    messageIndex,
    current: items[0]?.current ?? false,
    items
  }))
})
</script>
<style scoped lang="less">
.agent-panel {
  display: flex;
  flex-direction: column;
}

.agent-group {
  &__title {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 4px 6px;
  }
  &__round {
    font: var(--td-font-body-small);
    font-weight: 600;
    color: var(--td-text-color-placeholder);
  }
}

.agent-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: var(--td-radius-medium);
  cursor: pointer;
  user-select: none;
  transition:
    background-color 100ms ease-out,
    border-color 100ms ease-out;

  &:hover {
    background: var(--td-bg-color-component);
  }

  &.active {
    background: var(--td-brand-color-light);
    border-color: var(--td-brand-color);
  }
}

.agent-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
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

.agent-icon {
  font-size: var(--td-font-size-body-large);

  &--main {
    color: var(--td-brand-color);
  }

  &--success {
    color: var(--td-success-color);
  }

  &--error {
    color: var(--td-error-color);
  }

  &--default {
    color: var(--td-text-color-placeholder);
  }
}

.agent-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}

.agent-task {
  font: var(--td-font-body-medium);
  color: var(--td-text-color-primary);
}

.agent-meta {
  font: var(--td-font-body-small);
  color: var(--td-text-color-secondary);
  display: inline-flex;
  align-items: center;
}
</style>
