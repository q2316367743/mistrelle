<template>
  <div v-if="tabs.length > 0" class="sub-agent-tabs" role="tablist">
    <div class="tabs-inner">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        role="tab"
        :aria-selected="tab.id === activeId"
        class="agent-tab"
        :class="{ active: tab.id === activeId, running: tab.status === 'running' }"
        @click="$emit('switch', tab.id)"
      >
        <span class="tab-status">
          <span v-if="tab.status === 'running'" class="status-dot" aria-hidden="true" />
          <CheckCircleIcon v-else-if="tab.status === 'completed'" class="tab-check" />
          <ErrorCircleIcon v-else-if="tab.status === 'error'" class="tab-error" />
          <UserIcon v-else class="tab-user" />
        </span>
        <span class="tab-label">{{ tab.label }}</span>
        <span v-if="tab.task" class="tab-task ellipsis">{{ tab.task }}</span>
      </button>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { CheckCircleIcon, ErrorCircleIcon, UserIcon } from 'tdesign-icons-vue-next'

/** 单个 agent 切换卡片数据 */
export interface AgentTabItem {
  /** 'main' 表示主 Agent，否则为子 Agent ID */
  id: string
  /** 显示名称（主 Agent / 子 Agent N） */
  label: string
  /** 任务摘要（子 Agent 展示用，主 Agent 可为空） */
  task?: string
  /** 执行状态（子 Agent 展示用） */
  status?: 'running' | 'completed' | 'error'
}

defineProps<{
  tabs: AgentTabItem[]
  activeId: string
}>()

defineEmits<{
  (e: 'switch', agentId: string): void
}>()
</script>
<style scoped lang="less">
.sub-agent-tabs {
  position: sticky;
  bottom: 8px;
  z-index: 10;
  margin: 0 12px 4px;
  padding: 6px;
  border-radius: var(--td-radius-large);
  border: 1px solid var(--td-component-border);
  // Fluent Acrylic：半透明材质 + 背景模糊，浅色/深色主题自适应
  background: color-mix(in srgb, var(--td-bg-color-container) 82%, transparent);
  backdrop-filter: blur(20px) saturate(150%);
  box-shadow: var(--td-shadow-2);
}

.tabs-inner {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.agent-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  max-width: 280px;
  padding: 6px 12px;
  border: 1px solid transparent;
  border-radius: var(--td-radius-default);
  background: transparent;
  color: var(--td-text-color-secondary);
  cursor: pointer;
  user-select: none;
  transition:
    background-color 100ms ease-out,
    border-color 100ms ease-out,
    color 100ms ease-out,
    transform 80ms ease-in;

  &:hover {
    background: var(--td-bg-color-component);
    color: var(--td-text-color-primary);
  }

  &:active {
    transform: scale(0.98);
  }

  &:focus-visible {
    outline: 2px solid var(--td-brand-color);
    outline-offset: 2px;
  }

  &.active {
    background: var(--td-brand-color-light);
    border-color: var(--td-brand-color);
    color: var(--td-brand-color);
  }
}

.tab-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 18px;
  height: 18px;
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

.tab-check {
  color: var(--td-success-color);
  font-size: var(--td-font-size-body-large);
}

.tab-error {
  color: var(--td-error-color);
  font-size: var(--td-font-size-body-large);
}

.tab-user {
  color: var(--td-text-color-placeholder);
  font-size: var(--td-font-size-body-large);
}

.tab-label {
  font: var(--td-font-body-medium);
  font-weight: 600;
  color: inherit;
  flex-shrink: 0;
}

.tab-task {
  font: var(--td-font-body-small);
  color: var(--td-text-color-secondary);
  min-width: 0;
  overflow: hidden;
}
</style>
