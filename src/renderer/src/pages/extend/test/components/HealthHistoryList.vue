<template>
  <div class="history-list">
    <t-table
      row-key="id"
      size="small"
      :columns="columns"
      :data="list"
      :loading="initLoading"
    >
      <template #time="{ row }">
        {{ formatTime(row.createdAt) }}
      </template>
      <template #model="{ row }">
        <span :title="row.modelId">{{ row.modelName ?? row.modelId }}</span>
      </template>
      <template #provide="{ row }">{{ row.provideName ?? '手动' }}</template>
      <template #mode="{ row }">{{ row.mode === 'basic' ? '基础' : '完整' }}</template>
      <template #status="{ row }">
        <t-tag size="small" :theme="TASK_STATUS_THEMES[row.status]">
          {{ TASK_STATUS_LABELS[row.status] }}
        </t-tag>
      </template>
      <template #conclusion="{ row }">
        <t-tag size="small" :theme="CONCLUSION_THEMES[row.conclusion]">
          {{ CONCLUSION_LABELS[row.conclusion] }}
        </t-tag>
      </template>
      <template #passRate="{ row }">
        {{ passRate(row) }}
      </template>
      <template #duration="{ row }">
        {{ row.durationMs != null ? `${(row.durationMs / 1000).toFixed(1)}s` : '—' }}
      </template>
      <template #op="{ row }">
        <div class="op-buttons">
          <t-button variant="text" theme="primary" size="small" @click="emit('open', row)">
            查看
          </t-button>
          <t-popconfirm
            content="确认删除该检测记录？"
            :disabled="row.status === 'running'"
            @confirm="emit('remove', row.id)"
          >
            <t-button
              variant="text"
              theme="danger"
              size="small"
              :disabled="row.status === 'running'"
            >
              删除
            </t-button>
          </t-popconfirm>
        </div>
      </template>
    </t-table>
    <div v-if="hasMore" class="load-more">
      <t-button variant="outline" :loading="moreLoading" @click="emit('load-more')">
        加载更多（{{ list.length }} / {{ total }}）
      </t-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import dayjs from 'dayjs'
import type { TableProps } from 'tdesign-vue-next'
import {
  HEALTH_CONCLUSION_LABELS,
  HEALTH_TASK_STATUS_LABELS
} from '../health-report'
import { parseHealthItems } from '../useHealthChecks'

defineProps<{
  list: HealthRecordInput[]
  total: number
  initLoading: boolean
  moreLoading: boolean
  hasMore: boolean
}>()

const emit = defineEmits<{
  open: [record: HealthRecordInput]
  remove: [id: string]
  'load-more': []
}>()

const columns: TableProps['columns'] = [
  { colKey: 'createdAt', title: '时间', cell: 'time', width: 160 },
  { colKey: 'model', title: '模型', cell: 'model', ellipsis: true },
  { colKey: 'provide', title: '提供方', cell: 'provide', width: 120, ellipsis: true },
  { colKey: 'mode', title: '套餐', cell: 'mode', width: 72 },
  { colKey: 'status', title: '状态', cell: 'status', width: 88 },
  { colKey: 'conclusion', title: '结论', cell: 'conclusion', width: 88 },
  { colKey: 'passRate', title: '通过率', cell: 'passRate', width: 88 },
  { colKey: 'duration', title: '耗时', cell: 'duration', width: 80 },
  { colKey: 'op', title: '操作', cell: 'op', width: 120 }
]

const CONCLUSION_LABELS = HEALTH_CONCLUSION_LABELS
const CONCLUSION_THEMES: Record<HealthConclusion, 'success' | 'warning' | 'danger' | 'default'> = {
  healthy: 'success',
  risky: 'warning',
  danger: 'danger',
  unknown: 'default'
}
const TASK_STATUS_LABELS = HEALTH_TASK_STATUS_LABELS
const TASK_STATUS_THEMES: Record<HealthTaskStatus, 'primary' | 'success' | 'warning'> = {
  running: 'primary',
  finished: 'success',
  stopped: 'warning'
}

const formatTime = (time: number) => dayjs(time).format('YYYY-MM-DD HH:mm:ss')

/** 通过率：通过数 / 有效项数（跳过项不计） */
const passRate = (row: HealthRecordInput): string => {
  const items = parseHealthItems(row.items)
  if (!items.length) return '—'
  const valid = items.filter((it) => it.status !== 'skip').length
  if (!valid) return '—'
  return `${items.filter((it) => it.status === 'pass').length} / ${valid}`
}
</script>

<style scoped lang="less">
.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.op-buttons {
  display: inline-flex;
  gap: 4px;
}

.load-more {
  display: flex;
  justify-content: center;
}
</style>
