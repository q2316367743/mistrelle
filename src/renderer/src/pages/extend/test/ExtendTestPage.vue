<template>
  <page-layout title="大模型中转站可用性检测工具">
    <div class="test-page">
      <div class="config-panel">
        <div class="panel-title">
          检测配置
          <span v-if="running" class="panel-tip">检测进行中，暂时无法发起新检测</span>
        </div>
        <health-config-form :disabled="running" @start="start" />
      </div>

      <div v-if="current" class="run-panel-wrap">
        <div class="panel-title">任务状态</div>
        <health-run-panel :run="current" @stop="stop" />
      </div>

      <div class="history-panel">
        <div class="panel-title">
          历史记录
          <span class="panel-tip">共 {{ total }} 条</span>
        </div>
        <health-history-list
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
import { useHealthChecks } from './useHealthChecks'
import { openHealthRecord } from './modals/HealthRecordDrawer'
import HealthConfigForm from './components/HealthConfigForm.vue'
import HealthRunPanel from './components/HealthRunPanel.vue'
import HealthHistoryList from './components/HealthHistoryList.vue'

defineOptions({ name: 'ExtendTestPage' })

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
} = useHealthChecks()

onMounted(() => init())

// eslint-disable-next-line no-undef
const handleOpen = (record: HealthRecordInput) => {
  openHealthRecord(record)
}
</script>

<style scoped lang="less">
.test-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: calc(100% - 16px);
  min-height: 0;
  padding: 8px;
  overflow-y: auto;
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
