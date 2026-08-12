<template>
  <div
    class="plan-card"
    :class="`plan-card--${plan.status}`"
    @contextmenu="
      usePlanContextmenu($event, {
        addTask: () => emit('task', plan),
        viewDetail: () => emit('detail', plan),
        editPlan: () => emit('edit', plan),
        deletePlan: () => emit('remove', plan),
        viewAttachments: () => emit('files', plan),
      })
    "
  >
    <div class="plan-card__bar" />
    <div class="plan-card__body">
      <div class="plan-card__head">
        <span class="plan-card__title" :title="plan.title">{{ plan.title || '未命名计划' }}</span>
        <t-tooltip v-if="overdue" content="已逾期">
          <time-icon class="plan-card__overdue" />
        </t-tooltip>
      </div>

      <div v-if="plan.content" class="plan-card__content" :title="plan.content">
        {{ plan.content }}
      </div>

      <div class="plan-card__date">
        <calendar-icon class="plan-card__date-icon" />
        <span>{{ plan.startDate || '—' }}</span>
        <template v-if="plan.startDate !== plan.endDate">
          <span class="plan-card__date-sep">→</span>
          <span>{{ plan.endDate || '—' }}</span>
          <div v-if="diff !== null" class="plan-card__date-diff">· {{ diff }} 天</div>
        </template>
      </div>

      <div v-if="plan.tags.length > 0" class="plan-card__tags">
        <t-tag v-for="t in displayTags" :key="t" size="small" variant="light" theme="primary">
          {{ t }}
        </t-tag>
        <t-tag v-if="extraTagCount > 0" size="small" variant="light"> +{{ extraTagCount }} </t-tag>
      </div>

      <div class="plan-card__foot">
        <t-tag size="small" :theme="statusMeta.theme" variant="light">
          {{ statusMeta.label }}
        </t-tag>
        <t-tag size="small" :theme="priorityMeta.theme" variant="light">
          {{ priorityMeta.label }}
        </t-tag>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { CalendarIcon, MoreIcon, TimeIcon } from 'tdesign-icons-vue-next'
import { PLAN_STATUSES, PLAN_STATUS_META, PLAN_PRIORITY_META } from '@/modules/project'
import { dayDiff, isPlanOverdue } from '../func'
import type { ProjectPlan, ProjectPlanStatus } from '@/entity/project/ProjectPlan'
import { usePlanContextmenu } from '@/pages/project/plan/modals/PlanContextmenu'

const props = defineProps<{ plan: ProjectPlan }>()

const emit = defineEmits<{
  edit: [ProjectPlan]
  remove: [ProjectPlan]
  files: [ProjectPlan]
  task: [ProjectPlan]
  detail: [ProjectPlan]
  'status-change': [ProjectPlan, ProjectPlanStatus]
}>()

const statusOptions = PLAN_STATUSES.map((s) => ({ value: s, label: PLAN_STATUS_META[s].label }))

const priorityMeta = computed(() => PLAN_PRIORITY_META[props.plan.priority])
const statusMeta = computed(() => PLAN_STATUS_META[props.plan.status])

const overdue = computed(() => isPlanOverdue(props.plan))

const diff = computed(() => dayDiff(props.plan.startDate, props.plan.endDate))

const displayTags = computed(() => props.plan.tags.slice(0, 3))
const extraTagCount = computed(() => Math.max(0, props.plan.tags.length - 3))
</script>

<style scoped lang="less">
.plan-card {
  position: relative;
  display: flex;
  background: var(--td-bg-color-container);
  border: 1px solid var(--fluent-border-subtle);
  border-radius: var(--td-radius-medium);
  box-shadow: var(--fluent-elevation-1);
  cursor: pointer;
  overflow: hidden;
  transition:
    box-shadow var(--fluent-transition-fast),
    transform var(--fluent-transition-fast);

  &:hover {
    box-shadow: var(--fluent-elevation-2);
    transform: translateY(-1px);
  }

  &__bar {
    flex-shrink: 0;
    width: 4px;
    background: var(--td-text-color-placeholder);
  }

  &--padding &__bar {
    background: var(--td-text-color-secondary);
  }

  &--running &__bar {
    background: var(--td-brand-color);
  }

  &--pause &__bar {
    background: var(--td-warning-color);
  }

  &--complete &__bar {
    background: var(--td-success-color);
  }

  &__body {
    flex: 1;
    min-width: 0;
    padding: 12px 12px 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__head {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__title {
    flex: 1;
    min-width: 0;
    font: var(--td-font-title-small);
    color: var(--td-text-color-primary);
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__overdue {
    color: var(--td-error-color);
    flex-shrink: 0;
  }

  &__more {
    flex-shrink: 0;
  }

  &__content {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
    line-height: 1.5;
  }

  &__date {
    display: flex;
    align-items: center;
    gap: 4px;
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
  }

  &__date-icon {
    flex-shrink: 0;
  }

  &__date-sep {
    color: var(--td-text-color-placeholder);
  }

  &__date-diff {
    color: var(--td-text-color-placeholder);
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  &__foot {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 6px;
    border-top: 1px dashed var(--fluent-border-subtle);
  }

  &__actions {
    display: flex;
    gap: 12px;
  }
}
</style>
