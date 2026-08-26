<template>
  <div class="history-list">
    <t-table
      row-key="id"
      size="small"
      :columns="columns"
      :data="list"
      :loading="initLoading"
    >
      <template #createdAt="{ row }">
        {{ formatTime(row.createdAt) }}
      </template>
      <template #models="{ row }">
        <span :title="modelNamesText(row)">{{ modelNamesText(row) }}</span>
      </template>
      <template #execMode="{ row }">
        {{ COMPARE_EXEC_MODE_LABELS[row.config.execMode] }}
      </template>
      <template #status="{ row }">
        <t-tag size="small" :theme="row.status === 'finished' ? 'success' : row.status === 'running' ? 'primary' : 'warning'">
          {{ COMPARE_TASK_STATUS_LABELS[row.status] }}
        </t-tag>
      </template>
      <template #best="{ row }">
        <span class="best-text">{{ bestModelText(row) }}</span>
      </template>
      <template #duration="{ row }">
        {{ row.durationMs != null ? `${(row.durationMs / 1000).toFixed(1)}s` : '—' }}
      </template>
      <template #op="{ row }">
        <div class="op-cell">
          <t-link theme="primary" hover="color" @click="emit('open', row)">查看</t-link>
          <t-link theme="primary" hover="color" @click="handleExport(row)">导出</t-link>
          <t-popconfirm content="确认删除该对比记录？" @confirm="emit('remove', row.id)">
            <t-link v-if="row.status !== 'running'" theme="danger" hover="color">删除</t-link>
          </t-popconfirm>
        </div>
      </template>
    </t-table>

    <div class="load-more">
      <t-button
        v-if="hasMore"
        variant="outline"
        size="small"
        :loading="moreLoading"
        @click="emit('load-more')"
      >
        加载更多（{{ list.length }} / {{ total }}）
      </t-button>
      <span v-else-if="list.length" class="load-end">已加载全部 {{ total }} 条</span>
    </div>
  </div>
</template>

<script lang="ts" setup>
import dayjs from 'dayjs'
import type { BaseTableCol } from 'tdesign-vue-next'
import type { CompareRecord } from '../compare-types'
import { useModelCompare } from '../useModelCompare'
import { COMPARE_EXEC_MODE_LABELS, COMPARE_TASK_STATUS_LABELS } from '../compare-types'

const props = defineProps<{
  list: CompareRecord[]
  total: number
  initLoading: boolean
  moreLoading: boolean
  hasMore: boolean
}>()

const emit = defineEmits<{
  open: [record: CompareRecord]
  remove: [id: string]
  'load-more': []
}>()

const { exportReport } = useModelCompare()
const exportingKey = ref<string | null>(null)

/** 导出该记录 md 报告：dialog.save 自选路径（用户取消无副作用） */
const handleExport = async (row: CompareRecord): Promise<void> => {
  exportingKey.value = row.id
  try {
    await exportReport(row)
  } finally {
    exportingKey.value = null
  }
}

const columns: BaseTableCol[] = [
  { colKey: 'createdAt', title: '时间', width: 150 },
  { colKey: 'models', title: '模型', width: 200 },
  { colKey: 'execMode', title: '执行模式', width: 90 },
  { colKey: 'status', title: '状态', width: 90 },
  { colKey: 'best', title: '题集最优', width: 160 },
  { colKey: 'duration', title: '耗时', width: 90 },
  { colKey: 'op', title: '操作', width: 120 }
]

const formatTime = (time: number) => dayjs(time).format('YYYY-MM-DD HH:mm:ss')

const modelNamesText = (row: CompareRecord): string => {
  const names = row.config.models.map((it) => it.modelName || it.modelId)
  const head = names.slice(0, 3).join('、')
  return names.length > 3 ? `${head} 等 ${names.length} 个` : head
}

/** 题集通过率最高的模型（并列取多个；无题集数据返回 —） */
const bestModelText = (row: CompareRecord): string => {
  const scored = row.results
    .filter((it) => it.questions.length > 0)
    .map((it) => ({ name: it.target.modelName || it.target.modelId, rate: it.questionPassed / it.questions.length }))
  if (!scored.length) return '—'
  const top = Math.max(...scored.map((it) => it.rate))
  return scored
    .filter((it) => it.rate === top)
    .map((it) => it.name)
    .join('、')
}
</script>

<style scoped lang="less">
.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.op-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.best-text {
  font-size: 12px;
  color: var(--td-text-color-primary);
}

.load-more {
  display: flex;
  justify-content: center;
  align-items: center;

  .load-end {
    font-size: 12px;
    color: var(--td-text-color-placeholder);
  }
}
</style>