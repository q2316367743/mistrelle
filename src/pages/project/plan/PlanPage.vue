<template>
  <div class="plan-page">
    <div class="plan-page__toolbar">
      <t-button theme="primary" @click="handleCreate()">
        <template #icon><AddIcon /></template>
        新建计划
      </t-button>

      <t-radio-group v-model="filter" variant="primary-filled">
        <t-radio-button value="all">全部</t-radio-button>
        <t-radio-button v-for="s in PLAN_STATUSES" :key="s" :value="s">
          {{ PLAN_STATUS_META[s].label }}
        </t-radio-button>
      </t-radio-group>

      <t-tooltip content="刷新">
        <t-button theme="primary" variant="text" shape="square" @click="reload">
          <template #icon><RefreshIcon /></template>
        </t-button>
      </t-tooltip>
    </div>

    <div v-if="loading" class="plan-page__loading">
      <t-loading text="加载中…" />
    </div>
    <div v-else class="plan-page__board">
      <plan-column
        v-for="s in visibleStatuses"
        :key="s"
        :status="s"
        :plans="plansByStatus[s]"
        @add="(st) => handleCreate(st)"
        @edit="handleEdit"
        @remove="handleRemove"
        @files="handleFiles"
        @detail="handleDetail"
        @task="handleAddTask"
        @status-change="handleStatusChange"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { AddIcon, RefreshIcon } from 'tdesign-icons-vue-next'
import {
  PLAN_STATUSES,
  PLAN_STATUS_META,
  projectPlanAdd,
  projectPlanList,
  projectPlanRemove,
  projectPlanUpdate
} from '@/modules/project'
import { MessageBoxUtil, MessageUtil } from '@/utils/modal'
import type { ProjectPlan, ProjectPlanStatus } from '@/entity/project/ProjectPlan'
import PlanColumn from './components/PlanColumn.vue'
import { openPlanPutDialog } from './modals/PlanPutDialog'
import { openPlanFilesDialog } from './modals/PlanFilesDialog'
import { openPlanDetailDialog } from '@/pages/project/plan/modals/PlanDetailDialog'

const props = defineProps<{ id: string }>()

const loading = ref(false)
const items = ref<ProjectPlan[]>([])
const filter = ref<'all' | ProjectPlanStatus>('all')

const visibleStatuses = computed<ProjectPlanStatus[]>(() =>
  filter.value === 'all' ? [...PLAN_STATUSES] : [filter.value]
)

const plansByStatus = computed<Record<ProjectPlanStatus, ProjectPlan[]>>(() => {
  const map: Record<ProjectPlanStatus, ProjectPlan[]> = {
    padding: [],
    running: [],
    pause: [],
    complete: []
  }
  for (const it of items.value) {
    map[it.status].push(it)
  }
  return map
})

const reload = async () => {
  loading.value = true
  try {
    items.value = await projectPlanList(props.id)
  } catch (e) {
    MessageUtil.error('读取计划失败', e)
    items.value = []
  } finally {
    loading.value = false
  }
}

onMounted(reload)

const handleCreate = (status?: ProjectPlanStatus) => {
  openPlanPutDialog({
    projectId: props.id,
    defaultStatus: status,
    onSubmit: async (plan) => {
      await projectPlanAdd(props.id, plan)
      await reload()
    }
  })
}

const handleEdit = async (plan: ProjectPlan) => {
  openPlanPutDialog({
    projectId: props.id,
    current: plan,
    onSubmit: async (next) => {
      await projectPlanUpdate(props.id, next)
      await reload()
    }
  })
}

const handleStatusChange = async (plan: ProjectPlan, next: ProjectPlanStatus) => {
  try {
    await projectPlanUpdate(props.id, {
      ...plan,
      status: next,
      updatedAt: Date.now()
    })
    await reload()
  } catch (e) {
    MessageUtil.error('更新状态失败', e)
  }
}

const handleRemove = async (plan: ProjectPlan) => {
  try {
    await MessageBoxUtil.confirm(
      `确认删除计划「${plan.title}」？将一并删除该计划下的附件，数据不可恢复`,
      '删除计划'
    )
  } catch {
    return
  }
  try {
    await projectPlanRemove(props.id, plan.id)
    MessageUtil.success('已删除')
    await reload()
  } catch (e) {
    MessageUtil.error('删除失败', e)
  }
}

const handleFiles = (plan: ProjectPlan) => {
  openPlanFilesDialog({
    projectId: props.id,
    planId: plan.id,
    title: plan.title
  })
}

const handleDetail = async (plan: ProjectPlan) => {
  openPlanDetailDialog(plan)
}
const handleAddTask = async (plan: ProjectPlan) => {}
</script>

<style scoped lang="less">
.plan-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;

  &__toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    flex-shrink: 0;
  }

  &__loading {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__board {
    display: grid;
    grid-template-columns: repeat(4, minmax(260px, 1fr));
    gap: 12px;
    flex: 1;
    min-height: 0;
    overflow-x: auto;
  }
}
</style>
