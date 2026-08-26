<template>
  <div class="record-detail">
    <div class="detail-summary">
      <div class="summary-row">
        <span class="summary-label">时间</span>
        <span class="summary-value">{{ dayjs(record.createdAt).format('YYYY-MM-DD HH:mm:ss') }}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">模型</span>
        <span class="summary-value" :title="modelNames">{{ modelNames }}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">执行模式</span>
        <span class="summary-value">{{ COMPARE_EXEC_MODE_LABELS[record.config.execMode] }}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">状态</span>
        <t-tag size="small" :theme="statusTheme">{{ COMPARE_TASK_STATUS_LABELS[record.status] }}</t-tag>
        <span v-if="record.durationMs != null" class="summary-duration">
          耗时 {{ (record.durationMs / 1000).toFixed(1) }}s
        </span>
      </div>
      <div v-for="meta in record.config.models" :key="meta.modelId + meta.provideName" class="summary-row">
        <span class="summary-label">{{ meta.modelName || meta.modelId }}</span>
        <span class="summary-value" :title="`${meta.provideName} · ${meta.apiUrl} · ${meta.modelId} · ${meta.format}`">
          {{ meta.provideName }} · {{ meta.modelId }}（{{ meta.format }}）
        </span>
      </div>
    </div>

    <compare-result-view :record="record" />

    <div class="detail-actions">
      <t-button variant="outline" :loading="exporting" @click="handleExport">
        导出 md 报告
      </t-button>
      <t-button theme="default" variant="base" @click="emit('close')">关闭</t-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import dayjs from 'dayjs'
import CompareResultView from '../components/CompareResultView.vue'
import { useModelCompare } from '../useModelCompare'
import { COMPARE_EXEC_MODE_LABELS, COMPARE_TASK_STATUS_LABELS } from '../compare-types'
import type { CompareRecord } from '../compare-types'

const props = defineProps<{ record: CompareRecord }>()

const emit = defineEmits<{ close: [] }>()

const { exportReport } = useModelCompare()
const exporting = ref(false)

const modelNames = computed(() =>
  props.record.config.models.map((it) => it.modelName || it.modelId).join('、')
)

const statusTheme = computed(() =>
  props.record.status === 'finished' ? 'success' : props.record.status === 'running' ? 'primary' : 'warning'
)

/** 导出 md 报告：渲染 → dialog.save 自选路径 → 落盘 → 文件管理器定位 */
const handleExport = async (): Promise<void> => {
  exporting.value = true
  try {
    await exportReport(props.record)
  } finally {
    exporting.value = false
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

:deep(.compare-result) {
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

  .tab-body {
    flex: 1;
    min-height: 200px;
    max-height: none;
  }
}
</style>
