<template>
  <page-layout title="模型对比检测">
    <div class="compare-page">
      <div class="config-panel">
        <div class="panel-title">
          对比配置
          <span v-if="running" class="panel-tip">对比进行中，暂时无法发起新对比</span>
        </div>
        <compare-config-form :disabled="running" @start="start" />
      </div>

      <div v-if="current" class="run-panel-wrap">
        <div class="panel-title">任务状态</div>
        <compare-run-panel :run="current" @stop="stop" />
      </div>

      <div class="history-panel">
        <div class="panel-title">
          历史记录
          <span class="panel-tip">共 {{ total }} 条（报告可在列表中手动导出）</span>
        </div>
        <compare-history-list
          :list="list"
          :total="total"
          :init-loading="initLoading"
          :more-loading="moreLoading"
          :has-more="hasMore"
          @open="handleOpen"
          @remove="remove"
          @load-more="loadMore"
        />
      </div>
    </div>
  </page-layout>
</template>

<script lang="ts" setup>
import CompareConfigForm from './components/CompareConfigForm.vue'
import CompareRunPanel from './components/CompareRunPanel.vue'
import CompareHistoryList from './components/CompareHistoryList.vue'
import { useModelCompare } from './useModelCompare'
import { openCompareRecord } from './modals/CompareRecordDrawer'
import type { CompareRecord } from './compare-types'

defineOptions({ name: 'ExtendComparePage' })

const {
  list,
  total,
  initLoading,
  moreLoading,
  current,
  running,
  hasMore,
  loadMore,
  start,
  stop,
  remove,
  init
} = useModelCompare()

onMounted(() => init())

const handleOpen = (record: CompareRecord) => {
  openCompareRecord(record)
}
</script>

<style scoped lang="less">
.compare-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: calc(100% - 16px);
  min-height: 0;
  padding: 8px;
  overflow-y: auto;
  overflow-x: hidden;
}

.config-panel,
.run-panel-wrap,
.history-panel {
  flex-shrink: 0;
  padding: 16px;
  border: 1px solid var(--td-component-border);
  border-radius: 12px;
  background: var(--td-bg-color-container);
}

.panel-title {
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--td-text-color-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-tip {
  font-size: 12px;
  font-weight: 400;
  color: var(--td-text-color-placeholder);
}
</style>
