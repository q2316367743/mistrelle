<template>
  <div class="overview-table">
    <div v-if="summaryLines.length" class="summary-block">
      <div class="block-title">观察摘要</div>
      <ul class="summary-list">
        <li v-for="(line, i) in summaryLines" :key="i">{{ line }}</li>
      </ul>
    </div>

    <t-table row-key="metric" size="small" bordered :columns="columns" :data="rows" />
  </div>
</template>

<script lang="ts" setup>
import { h } from 'vue'
import type { BaseTableCol, BaseTableCellParams, TableRowData } from 'tdesign-vue-next'
import type { CompareRecord } from '../compare-types'
import { buildOverviewRows, buildSummaryLines, modelFullLabel } from '../compare-metrics'
import type { MetricCell, OverviewMetricRow } from '../compare-metrics'

const props = defineProps<{ record: CompareRecord }>()

const modelNames = computed(() => props.record.results.map(modelFullLabel))
const summaryLines = computed(() => buildSummaryLines(props.record.results))
const rows = computed(() => buildOverviewRows(props.record.results))

/** 模型列单元格：最优高亮 + 测速并发水位标注（cell 函数渲染，样式经 :deep 生效） */
const renderCell = (cells: MetricCell[], index: number) =>
  h('div', { class: ['metric-cell', cells[index].best ? 'metric-cell--best' : ''] }, [
    h('span', { class: 'metric-cell-text' }, cells[index].text),
    cells[index].best ? h('span', { class: 'metric-best' }, '⭐ 最优') : null,
    cells[index].note ? h('span', { class: 'metric-note' }, cells[index].note) : null
  ])

const columns = computed<BaseTableCol[]>(() => [
  { colKey: 'metric', title: '指标', width: 180 },
  ...modelNames.value.map((name, i): BaseTableCol => ({
    colKey: `m${i}`,
    title: name,
    // t-table 行类型固定 TableRowData，运行时实为本组件的 OverviewMetricRow
    cell: (_h, params: BaseTableCellParams<TableRowData>) =>
      renderCell((params.row as OverviewMetricRow).cells, i)
  }))
])
</script>

<style scoped lang="less">
.overview-table {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.summary-block {
  padding: 10px 14px;
  border: 1px solid var(--td-component-border);
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-container-hover);

  .block-title {
    margin-bottom: 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--td-text-color-secondary);
  }

  .summary-list {
    margin: 0;
    padding-left: 18px;
    display: flex;
    flex-direction: column;
    gap: 4px;

    li {
      font-size: 12.5px;
      color: var(--td-text-color-primary);
      line-height: 1.6;
    }
  }
}

:deep(.metric-cell) {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;

  .metric-cell-text {
    font-variant-numeric: tabular-nums;
    color: var(--td-text-color-primary);
  }

  .metric-best {
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 600;
    color: var(--td-success-color);
  }

  .metric-note {
    flex-shrink: 0;
    font-size: 11px;
    color: var(--td-warning-color);
  }
}

:deep(.metric-cell--best .metric-cell-text) {
  font-weight: 600;
  color: var(--td-success-color);
}
</style>
