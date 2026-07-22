<template>
  <aside class="session-list">
    <div class="session-list__header">
      <div>
        <div class="session-list__title">Session</div>
        <div class="session-list__desc">独立上下文，按轮沉淀</div>
      </div>
      <t-button size="small" theme="primary" variant="outline" @click="emit('new')">新建</t-button>
    </div>
    <div class="session-list__items">
      <t-empty v-if="records.length === 0" size="small" title="暂无讨论" description="输入议题后创建第一轮" />
      <button
        v-for="item in records"
        :key="item.id"
        :class="['session-list__item', { active: item.id === activeId }]"
        type="button"
        @click="emit('select', item.id)"
      >
        <div class="session-list__item-main">
          <span class="session-list__item-title">{{ item.name }}</span>
          <span class="session-list__item-meta">第 {{ item.currentRound }} 轮</span>
        </div>
        <t-tag size="small" variant="light" :theme="getStatusTheme(item.status)">
          {{ getStatusText(item.status) }}
        </t-tag>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { AiDiscussionRecordItem, AiDiscussionSessionStatus } from '@/entity/ai'

defineProps<{
  records: AiDiscussionRecordItem[]
  activeId?: string
}>()

const emit = defineEmits<{
  new: []
  select: [id: string]
}>()

const getStatusText = (status: AiDiscussionSessionStatus) => {
  if (status === 'running') return '运行中'
  if (status === 'stopped') return '已停止'
  if (status === 'completed') return '已完成'
  return '待推进'
}

const getStatusTheme = (status: AiDiscussionSessionStatus) => {
  if (status === 'running') return 'primary'
  if (status === 'stopped') return 'warning'
  if (status === 'completed') return 'success'
  return 'default'
}
</script>

<style scoped lang="less">
.session-list {
  display: flex;
  flex-direction: column;
  width: 272px;
  min-width: 240px;
  min-height: 0;
  padding: var(--td-comp-paddingTB-m);
  border-right: 1px solid var(--fluent-border-subtle);
  background: var(--fluent-acrylic-bg);
  backdrop-filter: var(--fluent-acrylic-blur);
}

.session-list__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--td-comp-margin-s);
  padding: 0 var(--td-comp-paddingLR-s) var(--td-comp-paddingTB-s);
}

.session-list__title {
  color: var(--td-text-color-primary);
  font: var(--td-font-title-medium);
}

.session-list__desc,
.session-list__item-meta {
  color: var(--td-text-color-secondary);
  font: var(--td-font-body-small);
}

.session-list__items {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--td-comp-margin-s);
  min-height: 0;
  overflow: auto;
}

.session-list__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--td-comp-margin-s);
  width: 100%;
  padding: var(--td-comp-paddingTB-s) var(--td-comp-paddingLR-s);
  color: var(--td-text-color-primary);
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--fluent-radius-smooth);
  cursor: pointer;
  transition:
    background var(--fluent-transition-fast),
    border-color var(--fluent-transition-fast),
    box-shadow var(--fluent-transition-fast);

  &:hover {
    background: var(--fluent-item-hover);
  }

  &.active {
    background: var(--fluent-item-selected);
    border-color: var(--fluent-border-subtle);
    box-shadow: var(--fluent-elevation-1);
  }
}

.session-list__item-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.session-list__item-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 820px) {
  .session-list {
    width: 100%;
    max-height: 176px;
    border-right: none;
    border-bottom: 1px solid var(--fluent-border-subtle);
  }
}
</style>
