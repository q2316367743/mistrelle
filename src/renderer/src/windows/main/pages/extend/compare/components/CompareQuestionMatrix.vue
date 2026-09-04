<template>
  <div class="question-matrix">
    <t-table row-key="key" size="small" bordered :columns="columns" :data="rows">
      <template #question="{ row }">
        <div class="question-cell">
          <t-tag size="small" variant="outline" class="question-tag">{{ row.tag }}</t-tag>
          <span class="question-text" :title="row.question">{{ row.question }}</span>
        </div>
      </template>
      <template #reference="{ row }">
        <span class="reference-text" :title="row.reference">{{ row.reference }}</span>
      </template>
      <template #op="{ row }">
        <t-link theme="primary" hover="color" @click="openAnswers(row.key)">答案对比</t-link>
      </template>
    </t-table>
  </div>
</template>

<script lang="ts" setup>
import { h } from 'vue'
import type { BaseTableCol, BaseTableCellParams, TableRowData } from 'tdesign-vue-next'
import type { CompareRecord } from '../compare-types'
import { modelFullLabel } from '../compare-metrics'
import { openCompareAnswers } from '../modals/CompareAnswersDialog'

interface MatrixMark {
  mark: string
  title: string
}

interface MatrixRow {
  key: string
  tag: string
  question: string
  reference: string
  cells: MatrixMark[]
}

const props = defineProps<{ record: CompareRecord }>()

const modelNames = computed(() => props.record.results.map(modelFullLabel))

const rows = computed<MatrixRow[]>(() => {
  const first = props.record.results[0]
  return (first?.questions ?? []).map((base) => ({
    key: base.key,
    tag: base.tag,
    question: base.question,
    reference: base.reference,
    cells: props.record.results.map((result) => {
      const item = result.questions.find((q) => q.key === base.key)
      if (!item) return { mark: '—', title: '未执行' }
      if (item.error) return { mark: '⚠️ 失败', title: item.error }
      const mark = item.pass === true ? '✅' : item.pass === false ? '❌' : '⚠️ 未判定'
      return {
        mark: item.truncated ? `${mark}（截断）` : mark,
        title: item.answer.slice(0, 100)
      }
    })
  }))
})

const markClass = (text: string): string => {
  if (text.startsWith('✅')) return 'qmark qmark--pass'
  if (text.startsWith('❌')) return 'qmark qmark--fail'
  if (text.startsWith('⚠️')) return 'qmark qmark--warn'
  return 'qmark'
}

const columns = computed<BaseTableCol[]>(() => [
  { colKey: 'question', title: '题目', width: 260, cell: 'question' },
  { colKey: 'reference', title: '参考答案', width: 140, cell: 'reference' },
  ...modelNames.value.map((name, i): BaseTableCol => ({
    colKey: `m${i}`,
    title: name,
    align: 'center',
    // t-table 行类型固定 TableRowData，运行时实为本组件行类型
    cell: (_h, params: BaseTableCellParams<TableRowData>) => {
      const cells = (params.row as { cells: MatrixMark[] }).cells
      return h('span', { class: markClass(cells[i].mark), title: cells[i].title }, cells[i].mark)
    }
  })),
  { colKey: 'op', title: '操作', width: 96, cell: 'op' }
])

const openAnswers = (questionKey: string): void => {
  openCompareAnswers(props.record, questionKey)
}
</script>

<style scoped lang="less">
.question-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;

  .question-tag {
    flex-shrink: 0;
  }

  .question-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12.5px;
    color: var(--td-text-color-primary);
  }
}

.reference-text {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

:deep(.qmark) {
  font-size: 12.5px;
  color: var(--td-text-color-primary);

  &.qmark--pass {
    color: var(--td-success-color);
  }

  &.qmark--fail {
    color: var(--td-error-color);
  }

  &.qmark--warn {
    color: var(--td-warning-color);
  }
}
</style>
