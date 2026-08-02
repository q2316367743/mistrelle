<template>
  <div v-if="tabs.length > 0" class="sub-agent-tabs">
    <div class="tabs-inner">
      <div
        v-for="tab in tabs"
        :key="tab.id"
        class="agent-tab"
        :class="{ active: tab.id === activeId }"
        @click="$emit('switch', tab.id)"
      >
        <span class="tab-icon">
          <t-loading v-if="tab.status === 'running'" size="small" />
          <CheckCircleIcon v-else-if="tab.status === 'completed'" class="tab-check" />
          <ErrorCircleIcon v-else-if="tab.status === 'error'" class="tab-error" />
          <UserIcon v-else class="tab-user" />
        </span>
        <span class="tab-label">{{ tab.label }}</span>
        <span v-if="tab.task" class="tab-task ellipsis">{{ tab.task }}</span>
      </div>
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
  bottom: 0;
  z-index: 10;
  padding: var(--td-comp-paddingTB-s) var(--td-comp-paddingLR-md);
  background: var(--td-bg-color-container);
  border-top: 1px solid var(--td-component-border);
  border-radius: var(--td-radius-medium) var(--td-radius-medium) 0 0;
  box-shadow: 0 -2px 8px rgb(0 0 0 / 4%);
}

.tabs-inner {
  display: flex;
  gap: var(--td-comp-margin-s);
  overflow-x: auto;
  scrollbar-width: thin;
}

.agent-tab {
  display: flex;
  align-items: center;
  gap: var(--td-comp-margin-xs);
  flex-shrink: 0;
  max-width: 260px;
  padding: var(--td-comp-paddingTB-xs) var(--td-comp-paddingLR-s);
  border-radius: var(--td-radius-medium);
  border: 1px solid var(--td-component-border);
  background: var(--td-bg-color-secondary);
  cursor: pointer;
  user-select: none;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;

  &:hover {
    border-color: var(--td-brand-color);
  }

  &.active {
    border-color: var(--td-brand-color);
    background: var(--td-brand-color-light);
  }
}

.tab-icon {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  color: var(--td-text-color-placeholder);
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
  font-weight: 500;
  color: var(--td-text-color-primary);
  flex-shrink: 0;
}

.tab-task {
  font: var(--td-font-body-small);
  color: var(--td-text-color-secondary);
  min-width: 0;
  overflow: hidden;
}
</style>
