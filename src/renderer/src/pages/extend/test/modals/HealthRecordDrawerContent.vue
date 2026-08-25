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

    <health-result-view :items="items" :logs="logs" :report="current.report" />

    <div class="detail-actions">
      <t-button variant="outline" :loading="regenerating" @click="handleRegenerate">
        {{ current.report ? '重新生成报告' : '生成审计报告' }}
      </t-button>
      <t-button theme="default" variant="base" @click="emit('close')">关闭</t-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import dayjs from 'dayjs'
import HealthResultView from '../components/HealthResultView.vue'
import { HEALTH_CONCLUSION_LABELS, HEALTH_TASK_STATUS_LABELS } from '../health-report'
import { parseHealthItems, parseHealthLogs, useHealthChecks } from '../useHealthChecks'

// eslint-disable-next-line no-undef
const props = defineProps<{ record: HealthRecordInput }>()

const emit = defineEmits<{ close: [] }>()

const { regenerateReport } = useHealthChecks()

/** 展示副本：重新生成报告后用新记录替换（列表与 DB 同步在 composable 内完成） */
// eslint-disable-next-line no-undef
const current = ref<HealthRecordInput>(props.record)
watch(
  () => props.record,
  (record) => (current.value = record)
)

const items = computed(() => parseHealthItems(current.value.items))
const logs = computed(() => parseHealthLogs(current.value.logs))
const regenerating = ref(false)

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

const handleRegenerate = async () => {
  regenerating.value = true
  try {
    current.value = await regenerateReport(current.value)
  } finally {
    regenerating.value = false
  }
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
