<template>
  <div class="run-panel">
    <div class="run-status">
      <div class="status-fields">
        <div class="status-field">
          <span class="field-name">任务 ID</span>
          <span class="field-value">{{ run.record.id }}</span>
        </div>
        <div class="status-field">
          <span class="field-name">状态</span>
          <t-tag v-if="isRunning" theme="primary" size="small">对比中</t-tag>
          <t-tag v-else :theme="run.record.status === 'finished' ? 'success' : 'warning'" size="small">
            {{ run.record.status === 'finished' ? '已完成' : '已停止' }}
          </t-tag>
        </div>
        <div class="status-field">
          <span class="field-name">执行模式</span>
          <span class="field-value">{{ COMPARE_EXEC_MODE_LABELS[run.record.config.execMode] }}</span>
        </div>
        <div class="status-field">
          <span class="field-name">模型数</span>
          <span class="field-value">{{ run.record.results.length }}</span>
        </div>
        <div class="status-field">
          <span class="field-name">耗时</span>
          <span class="field-value">{{ durationText }}</span>
        </div>
      </div>
      <t-button
        v-if="isRunning"
        theme="danger"
        variant="outline"
        :loading="run.stopping"
        @click="emit('stop')"
      >
        <template #icon><StopCircleIcon /></template>
        停止对比
      </t-button>
    </div>

    <div class="run-progress">
      <span class="progress-text">请求进度 {{ doneRequests }} / {{ run.totalRequests }}</span>
      <t-progress
        class="progress-bar"
        :percentage="progressPercent"
        :status="isRunning ? undefined : run.record.status === 'finished' ? 'success' : 'warning'"
      />
    </div>

    <div class="model-grid">
      <div v-for="result in run.record.results" :key="result.target.modelId + result.target.provideName" class="model-card">
        <div class="card-head">
          <span class="model-name" :title="`${result.target.modelName}（${result.target.modelId}）`">
            {{ result.target.modelName }}
          </span>
          <t-tag size="small" :theme="COMPARE_MODEL_STATUS_THEMES[result.status]">
            {{ COMPARE_MODEL_STATUS_LABELS[result.status] }}
          </t-tag>
        </div>
        <div class="card-provider" :title="result.target.apiUrl">
          {{ result.target.provideName }} · {{ result.target.modelId }}
        </div>
        <div class="card-stage">{{ result.stage }}</div>
        <div class="card-metrics">
          <div class="metric">
            <span class="metric-name">TTFT 中位</span>
            <span class="metric-value">{{ fmtSec(result.speedMedian?.ttftMs) }}</span>
          </div>
          <div class="metric">
            <span class="metric-name">tok/s 中位</span>
            <span class="metric-value">{{ fmtRate(result.speedMedian?.tokPerSec) }}</span>
          </div>
          <div class="metric">
            <span class="metric-name">题集</span>
            <span class="metric-value">{{ result.questionPassed }}/{{ result.questions.length }}</span>
          </div>
        </div>
        <div v-if="result.error" class="card-error">{{ result.error }}</div>
      </div>
    </div>

    <div v-if="isRunning" class="run-logs">
      <div class="logs-title">执行日志</div>
      <compare-log-list :logs="run.record.logs" auto-scroll />
    </div>
    <template v-else>
      <div class="run-actions">
        <t-button variant="outline" :loading="exporting" @click="handleExport">
          <template #icon><DownloadIcon /></template>
          导出报告
        </t-button>
      </div>
      <compare-result-view :record="run.record" />
    </template>
  </div>
</template>

<script lang="ts" setup>
import { DownloadIcon, StopCircleIcon } from 'tdesign-icons-vue-next'
import CompareLogList from './CompareLogList.vue'
import CompareResultView from './CompareResultView.vue'
import { COMPARE_MODEL_STATUS_LABELS, COMPARE_EXEC_MODE_LABELS } from '../compare-types'
import { COMPARE_MODEL_STATUS_THEMES, countDoneRequests, useModelCompare } from '../useModelCompare'
import type { CompareRun } from '../useModelCompare'

const props = defineProps<{ run: CompareRun }>()

const emit = defineEmits<{ stop: [] }>()

const { exportReport } = useModelCompare()
const exporting = ref(false)

/** 导出电子报告：渲染 → dialog.save 自选路径 → 落盘 → 文件管理器定位（用户取消无副作用） */
const handleExport = async (): Promise<void> => {
  exporting.value = true
  try {
    await exportReport(props.run.record)
  } finally {
    exporting.value = false
  }
}

const isRunning = computed(() => props.run.record.status === 'running')
const doneRequests = computed(() => countDoneRequests(props.run.record))
const progressPercent = computed(() =>
  props.run.totalRequests ? Math.round((doneRequests.value / props.run.totalRequests) * 100) : 0
)
const durationText = computed(() => {
  const ms = props.run.record.durationMs
  if (ms == null) return '—'
  return `${(ms / 1000).toFixed(1)}s`
})

const fmtSec = (ms?: number | null): string => (ms != null ? `${(ms / 1000).toFixed(2)}s` : '—')
const fmtRate = (value?: number | null): string => (value != null ? value.toFixed(1) : '—')
</script>

<style scoped lang="less">
.run-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.run-status {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.status-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  min-width: 0;
}

.status-field {
  display: flex;
  align-items: center;
  gap: 6px;

  .field-name {
    flex-shrink: 0;
    font-size: 12px;
    color: var(--td-text-color-placeholder);
  }

  .field-value {
    font-size: 13px;
    color: var(--td-text-color-primary);
    font-variant-numeric: tabular-nums;
  }
}

.run-progress {
  display: flex;
  align-items: center;
  gap: 12px;

  .progress-text {
    flex-shrink: 0;
    font-size: 12px;
    color: var(--td-text-color-secondary);
    font-variant-numeric: tabular-nums;
  }

  .progress-bar {
    flex: 1;
    min-width: 0;
  }
}

.model-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  align-content: start;
}

.model-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border: 1px solid var(--td-component-border);
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-container-hover);
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;

  .model-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 600;
    color: var(--td-text-color-primary);
  }
}

.card-provider {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-stage {
  font-size: 12px;
  color: var(--td-brand-color);
}

.card-metrics {
  display: flex;
  gap: 12px;

  .metric {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;

    .metric-name {
      font-size: 11px;
      color: var(--td-text-color-placeholder);
    }

    .metric-value {
      font-size: 13px;
      color: var(--td-text-color-primary);
      font-variant-numeric: tabular-nums;
    }
  }
}

.card-error {
  font-size: 12px;
  color: var(--td-error-color);
  word-break: break-all;
}

.run-logs {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .logs-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--td-text-color-secondary);
  }

  .compare-log-list {
    max-height: 200px;
    border: 1px solid var(--td-component-border);
    border-radius: var(--td-radius-medium);
  }
}

.run-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
