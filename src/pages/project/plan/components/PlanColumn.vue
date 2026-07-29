<template>
  <div class="plan-column">
    <div class="plan-column__head">
      <div class="plan-column__title">
        <span class="plan-column__dot" :class="`plan-column__dot--${status}`" />
        <span>{{ meta.label }}</span>
        <span class="plan-column__count">{{ plans.length }}</span>
      </div>
      <t-tooltip content="新建计划">
        <t-button
          theme="default"
          variant="text"
          shape="square"
          size="small"
          @click="emit('add', status)"
        >
          <template #icon><AddIcon /></template>
        </t-button>
      </t-tooltip>
    </div>

    <div v-if="plans.length > 0" class="plan-column__list">
      <plan-card
        v-for="p in plans"
        :key="p.id"
        :plan="p"
        @edit="(plan) => emit('edit', plan)"
        @remove="(plan) => emit('remove', plan)"
        @files="(plan) => emit('files', plan)"
        @task="(plan) => emit('task', plan)"
        @detail="(plan) => emit('detail', plan)"
        @status-change="(plan, s) => emit('status-change', plan, s)"
      />
    </div>
    <div v-else class="plan-column__empty">
      <span>暂无{{ meta.label }}计划</span>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { AddIcon } from 'tdesign-icons-vue-next'
import { PLAN_STATUS_META } from '@/modules/project'
import type { ProjectPlan, ProjectPlanStatus } from '@/entity/project/ProjectPlan'
import PlanCard from './PlanCard.vue'

const props = defineProps<{ status: ProjectPlanStatus; plans: ProjectPlan[] }>()

const emit = defineEmits<{
  add: [ProjectPlanStatus]
  edit: [ProjectPlan]
  remove: [ProjectPlan]
  files: [ProjectPlan]
  task: [ProjectPlan]
  detail: [ProjectPlan]
  'status-change': [ProjectPlan, ProjectPlanStatus]
}>()

const meta = computed(() => PLAN_STATUS_META[props.status])
</script>

<style scoped lang="less">
.plan-column {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 240px;
  background: var(--td-bg-color-container);
  border: 1px solid var(--fluent-border-subtle);
  border-radius: var(--td-radius-medium);
  overflow: hidden;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid var(--fluent-border-subtle);
    background: var(--td-bg-color-container);
    flex-shrink: 0;
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 8px;
    font: var(--td-font-title-small);
    color: var(--td-text-color-primary);
    font-weight: 600;
  }

  &__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--td-text-color-placeholder);

    &--padding {
      background: var(--td-text-color-secondary);
    }

    &--running {
      background: var(--td-brand-color);
    }

    &--pause {
      background: var(--td-warning-color);
    }

    &--complete {
      background: var(--td-success-color);
    }
  }

  &__count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 10px;
    background: var(--td-bg-color-component);
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }

  &__empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--td-text-color-placeholder);
    font: var(--td-font-body-small);
  }
}
</style>
