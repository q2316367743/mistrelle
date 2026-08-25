<template>
  <div class="run-panel">
    <div class="run-status">
      <div class="status-fields">
        <div class="status-field">
          <span class="field-name">任务 ID</span>
          <span class="field-value">{{ run.record.id }}</span>
        </div>
        <div class="status-field">
          <span class="field-name">风险结论</span>
          <t-tag v-if="isRunning" theme="primary" size="small">检测中</t-tag>
          <t-tag v-else :theme="CONCLUSION_THEMES[run.record.conclusion]" size="small">
            {{ CONCLUSION_LABELS[run.record.conclusion] }}
          </t-tag>
        </div>
        <div class="status-field wide">
          <span class="field-name">目标地址</span>
          <span class="field-value" :title="run.record.apiUrl">{{ run.record.apiUrl }}</span>
        </div>
        <div class="status-field wide">
          <span class="field-name">检测模型</span>
          <span class="field-value" :title="run.record.modelId">
            {{ run.record.modelName ?? run.record.modelId }}（{{ run.record.modelId }}）
          </span>
        </div>
        <div class="status-field">
          <span class="field-name">检测项目</span>
          <span class="field-value">{{ run.record.mode === 'basic' ? '基础检测' : '完整检测' }}</span>
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
        停止检测
      </t-button>
    </div>

    <div class="run-progress">
      <span class="progress-text">步骤进度 {{ run.items.length }} / {{ run.total }}</span>
      <t-progress
        class="progress-bar"
        :percentage="progressPercent"
        :status="isRunning ? undefined : progressStatus"
      />
    </div>

    <health-result-view
      :items="run.items"
      :logs="run.logs"
      :report="reportHtml"
      :auto-scroll-logs="isRunning"
    />
  </div>
</template>

<script lang="ts" setup>
import { StopCircleIcon } from 'tdesign-icons-vue-next'
import HealthResultView from './HealthResultView.vue'
import { HEALTH_CONCLUSION_LABELS, buildHealthReport } from '../health-report'
import type { HealthRun } from '../useHealthChecks'

const props = defineProps<{ run: HealthRun }>()

const emit = defineEmits<{ stop: [] }>()

const CONCLUSION_LABELS = HEALTH_CONCLUSION_LABELS
const CONCLUSION_THEMES: Record<HealthConclusion, 'success' | 'warning' | 'danger' | 'default'> = {
  healthy: 'success',
  risky: 'warning',
  danger: 'danger',
  unknown: 'default'
}

const isRunning = computed(() => props.run.record.status === 'running')
const progressPercent = computed(() =>
  props.run.total ? Math.round((props.run.items.length / props.run.total) * 100) : 0
)
const progressStatus = computed(() => {
  if (props.run.record.status === 'stopped') return 'warning' as const
  if (props.run.record.conclusion === 'healthy') return 'success' as const
  if (props.run.record.conclusion === 'danger') return 'error' as const
  return undefined
})

/** 审计报告 HTML：任务收尾（结束 / 停止）后由数据动态生成，不落库 */
const reportHtml = ref<string | null>(null)
watch(
  () => props.run.record.status,
  async (status) => {
    if (status === 'running') {
      reportHtml.value = null
      return
    }
    reportHtml.value = await buildHealthReport({
      ...props.run.record,
      items: props.run.items,
      logs: props.run.logs
    })
  },
  { immediate: true }
)
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
  min-width: 0;

  &.wide .field-value {
    max-width: 320px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .field-name {
    flex-shrink: 0;
    font-size: 12px;
    color: var(--td-text-color-placeholder);
  }

  .field-value {
    font-size: 13px;
    color: var(--td-text-color-primary);
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
</style>
