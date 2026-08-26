<template>
  <div class="profile-matrix">
    <div class="matrix-title">分类能力画像（通过数 / 题数，全对 ✅ · 部分 ⚠️ · 全错 ❌）</div>
    <t-table row-key="tag" size="small" bordered :columns="columns" :data="rows" />
  </div>
</template>

<script lang="ts" setup>
import { h } from 'vue'
import type { BaseTableCol, BaseTableCellParams, TableRowData } from 'tdesign-vue-next'
import type { CompareRecord } from '../compare-types'
import { buildProfileRows, modelLabel } from '../compare-metrics'

const props = defineProps<{ record: CompareRecord }>()

const modelNames = computed(() => props.record.results.map(modelLabel))
const rows = computed(() => buildProfileRows(props.record.results))

const markClass = (text: string): string => {
  if (text.startsWith('✅')) return 'profile-cell profile-cell--good'
  if (text.startsWith('⚠️')) return 'profile-cell profile-cell--mid'
  if (text.startsWith('❌')) return 'profile-cell profile-cell--bad'
  return 'profile-cell'
}

const columns = computed<BaseTableCol[]>(() => [
  { colKey: 'tag', title: '分类', width: 120 },
  ...modelNames.value.map((name, i): BaseTableCol => ({
    colKey: `m${i}`,
    title: name,
    align: 'center',
    // t-table 行类型固定 TableRowData，运行时实为本组件行类型
    cell: (_h, params: BaseTableCellParams<TableRowData>) => {
      const cells = (params.row as { cells: string[] }).cells
      return h('span', { class: markClass(cells[i]) }, cells[i])
    }
  }))
])
</script>

<style scoped lang="less">
.profile-matrix {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.matrix-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--td-text-color-secondary);
}

:deep(.profile-cell) {
  font-variant-numeric: tabular-nums;
  color: var(--td-text-color-primary);

  &.profile-cell--good {
    color: var(--td-success-color);
  }

  &.profile-cell--mid {
    color: var(--td-warning-color);
  }

  &.profile-cell--bad {
    color: var(--td-error-color);
  }
}
</style>
