<template>
  <div class="record-detail">
    <div class="detail-summary">
      <div class="summary-row">
        <span class="summary-label">时间</span>
        <span class="summary-value">{{
          dayjs(current.createdAt).format('YYYY-MM-DD HH:mm:ss')
        }}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">模型</span>
        <span class="summary-value" :title="current.modelId">
          {{ current.modelName ? `${current.modelName}（${current.modelId}）` : current.modelId }}
        </span>
      </div>
      <div class="summary-row">
        <span class="summary-label">提供方</span>
        <span class="summary-value">{{ current.provideName ?? '手动填写' }}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">地址</span>
        <span class="summary-value" :title="current.apiUrl">{{ current.apiUrl }}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">状态</span>
        <t-tag size="small" :theme="STATUS_THEMES[current.status]">
          {{ TASK_STATUS_LABELS[current.status] }}
        </t-tag>
        <t-tag size="small" :theme="CONCLUSION_THEMES[current.conclusion]" class="summary-tag">
          {{ CONCLUSION_LABELS[current.conclusion] }}
        </t-tag>
        <span v-if="current.durationMs != null" class="summary-duration">
          耗时 {{ (current.durationMs / 1000).toFixed(1) }}s
        </span>
      </div>
    </div>

    <health-result-view :items="items" :logs="logs" :report="reportHtml" />

    <div v-if="exportedPath" class="exported-path">
      <span class="path-label">已导出：</span>
      <t-link theme="primary" hover="color" @click="locateExported">
        {{ exportedPath }}
      </t-link>
    </div>

    <div class="detail-actions">
      <t-button variant="outline" :loading="exporting" @click="handleExport">
        导出 HTML 报告
      </t-button>
      <t-button theme="default" variant="base" @click="emit('close')">关闭</t-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import dayjs from 'dayjs'
import HealthResultView from '../components/HealthResultView.vue'
import { HEALTH_CONCLUSION_LABELS, HEALTH_TASK_STATUS_LABELS, buildHealthReport } from '../health-report'
import { parseHealthItems, parseHealthLogs, useHealthChecks } from '../useHealthChecks'

// eslint-disable-next-line no-undef
const props = defineProps<{ record: HealthRecordInput }>()

const emit = defineEmits<{ close: [] }>()

const { exportReport } = useHealthChecks()

// eslint-disable-next-line no-undef
const current = ref<HealthRecordInput>(props.record)
watch(
  () => props.record,
  (record) => (current.value = record)
)

const items = computed(() => parseHealthItems(current.value.items))
const logs = computed(() => parseHealthLogs(current.value.logs))

/** 审计报告 HTML：由记录数据动态生成（EJS 模板在主进程渲染），不落库 */
const reportHtml = ref<string | null>(null)
watch(
  [current, items],
  async ([record, parsedItems]) => {
    reportHtml.value = await buildHealthReport({ ...record, items: parsedItems, logs: logs.value })
  },
  { immediate: true }
)

const exporting = ref(false)
const exportedPath = ref('')

const CONCLUSION_LABELS = HEALTH_CONCLUSION_LABELS
// eslint-disable-next-line no-undef
const CONCLUSION_THEMES: Record<HealthConclusion, 'success' | 'warning' | 'danger' | 'default'> = {
  healthy: 'success',
  risky: 'warning',
  danger: 'danger',
  unknown: 'default'
}
const TASK_STATUS_LABELS = HEALTH_TASK_STATUS_LABELS
// eslint-disable-next-line no-undef
const STATUS_THEMES: Record<HealthTaskStatus, 'primary' | 'success' | 'warning'> = {
  running: 'primary',
  finished: 'success',
  stopped: 'warning'
}

const handleExport = async () => {
  exporting.value = true
  try {
    exportedPath.value = await exportReport(current.value)
    window.preload.inject.shell.showItemInFolder(exportedPath.value)
  } finally {
    exporting.value = false
  }
}

const locateExported = () => {
  if (exportedPath.value) window.preload.inject.shell.showItemInFolder(exportedPath.value)
}
</script>

<style scoped lang="less">
.record-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
}

.detail-summary {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 16px;
  border: 1px solid var(--td-component-border);
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-container-hover);
}

.summary-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;

  .summary-label {
    flex-shrink: 0;
    width: 40px;
    font-size: 12px;
    color: var(--td-text-color-placeholder);
  }

  .summary-value {
    font-size: 13px;
    color: var(--td-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .summary-tag {
    margin-left: 4px;
  }

  .summary-duration {
    margin-left: 8px;
    font-size: 12px;
    color: var(--td-text-color-secondary);
  }
}

.exported-path {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 8px 12px;
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-container-hover);

  .path-label {
    flex-shrink: 0;
    font-size: 12px;
    color: var(--td-text-color-placeholder);
  }

  :deep(.t-link) {
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.detail-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

:deep(.health-result) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;

  .t-tabs__content {
    flex: 1;
    min-height: 0;

    .t-tab-panel {
      height: 100%;
      overflow-y: auto;
    }
  }

  .overview-body,
  .report-body,
  .log-body {
    flex: 1;
    min-height: 200px;
    max-height: none;
  }
}
</style>
