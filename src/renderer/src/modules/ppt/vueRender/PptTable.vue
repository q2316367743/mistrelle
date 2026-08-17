<template>
  <div class="ppt-table" :data-node-id="node.id" :style="[boxStyle, gridStyle]">
    <div
      v-for="cell in cells"
      :key="cell.key"
      class="ppt-table__cell"
      :data-node-id="cell.node.id"
      :style="cellStyle(cell)"
    >
      {{ cell.text }}
    </div>
  </div>
</template>
<script lang="ts" setup>
/**
 * Table 表格节点 → CSS Grid：Col 定义列宽（省略均分），Tr 定义行（height 或 defaultRowHeight），
 * Td 按 colspan/rowspan 经占位矩阵定位（grid-area）；单元格背景 / 文本样式取 Td attr。
 */
import { computed, type CSSProperties } from 'vue'
import type { PptTheme, SlideNode } from '../pptTypes'
import { attrNum, commonStyle, resolveColor, textStyle } from './attrStyle'

const props = defineProps<{ node: SlideNode; theme: PptTheme }>()

interface CellPlan {
  key: string
  node: SlideNode
  text: string
  row: number
  col: number
  colspan: number
  rowspan: number
}

const cols = computed<SlideNode[]>(() =>
  Array.isArray(props.node.child) ? props.node.child.filter((c) => c.tag === 'Col') : []
)
const rows = computed<SlideNode[]>(() =>
  Array.isArray(props.node.child)
    ? props.node.child.filter((c) => c.tag === 'Tr' && Array.isArray(c.child))
    : []
)

/** 列数：显式 Col 优先，否则按各行列跨度合计最大值 */
const colCount = computed(() => {
  if (cols.value.length) return cols.value.length
  let max = 0
  for (const tr of rows.value) {
    let sum = 0
    for (const td of (tr.child as SlideNode[]) ?? []) {
      sum += attrNum(td.attr, 'colspan', 1)
    }
    max = Math.max(max, sum)
  }
  return max
})

/** 占位矩阵布局：逐行放置，跳过被上方 rowspan 占用的格子 */
const cells = computed<CellPlan[]>(() => {
  const n = colCount.value
  if (!n) return []
  const occupied: boolean[][] = Array.from({ length: rows.value.length + 40 }, () =>
    Array(n).fill(false)
  )
  const result: CellPlan[] = []
  rows.value.forEach((tr, r) => {
    let c = 0
    for (const td of (tr.child as SlideNode[]) ?? []) {
      while (c < n && occupied[r][c]) c += 1
      if (c >= n) break
      const colspan = Math.min(attrNum(td.attr, 'colspan', 1), n - c)
      const rowspan = attrNum(td.attr, 'rowspan', 1)
      for (let dr = 0; dr < rowspan; dr += 1) {
        for (let dc = 0; dc < colspan; dc += 1) {
          if (occupied[r + dr]) occupied[r + dr][c + dc] = true
        }
      }
      result.push({
        key: td.id ?? `${r}-${c}`,
        node: td,
        text: typeof td.child === 'string' ? td.child : '',
        row: r,
        col: c,
        colspan,
        rowspan
      })
      c += colspan
    }
  })
  return result
})

const boxStyle = computed<CSSProperties>(() => commonStyle(props.node, props.theme))

const gridStyle = computed<CSSProperties>(() => ({
  display: 'grid',
  gridTemplateColumns: cols.value.length
    ? cols.value
        .map((col) => {
          const width = attrNum(col.attr, 'width', NaN)
          return Number.isFinite(width) ? `${width}px` : '1fr'
        })
        .join(' ')
    : `repeat(${colCount.value}, 1fr)`,
  gridTemplateRows: rows.value
    .map((tr) => {
      const height = attrNum(tr.attr, 'height', NaN)
      const fallback = attrNum(props.node.attr, 'defaultRowHeight', 32)
      return `${Number.isFinite(height) ? height : fallback}px`
    })
    .join(' ')
}))

const cellBorderCss = computed(() => {
  const color = resolveColor(props.node.attr['cellBorder.color'], props.theme)
  if (!color) return '1px solid rgba(0,0,0,0.25)'
  const width = attrNum(props.node.attr, 'cellBorder.width', 1)
  return `${width}px solid ${color}`
})

const cellStyle = (cell: CellPlan): CSSProperties[] => [
  {
    gridRow: `${cell.row + 1} / span ${cell.rowspan}`,
    gridColumn: `${cell.col + 1} / span ${cell.colspan}`,
    border: cellBorderCss.value,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: resolveColor(cell.node.attr.backgroundColor, props.theme),
    overflow: 'hidden'
  },
  textStyle(cell.node.attr, props.theme)
]
</script>
<style scoped lang="less">
.ppt-table {
  // 相邻单元格边框合并（grid 无 border-collapse）
  &__cell {
    white-space: pre-wrap;
    overflow-wrap: break-word;
    margin-top: -1px;
    margin-left: -1px;
  }
}
</style>
