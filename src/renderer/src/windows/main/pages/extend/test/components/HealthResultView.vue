<template>
  <t-tabs v-model="tab" class="health-result">
    <t-tab-panel value="overview" label="结果概览" :destroy-on-hide="false">
      <div class="overview-body">
        <template v-if="items.length">
          <div v-for="group in itemGroups" :key="group.dimension" class="item-group">
            <div class="group-title">{{ group.dimension }}</div>
            <div v-for="item in group.items" :key="item.key" class="item-row">
              <div class="item-main">
                <t-tag size="small" :theme="STATUS_THEMES[item.status]" class="item-tag">
                  {{ STATUS_LABELS[item.status] }}
                </t-tag>
                <span class="item-name">{{ item.name }}</span>
                <span v-if="item.latencyMs != null" class="item-latency"
                  >{{ item.latencyMs }}ms</span
                >
              </div>
              <div v-if="item.detail" class="item-detail">{{ item.detail }}</div>
            </div>
          </div>
        </template>
        <t-empty v-else description="暂无检测项结果" />
      </div>
    </t-tab-panel>

    <t-tab-panel value="report" label="审计报告" :destroy-on-hide="false">
      <div class="report-body">
        <iframe
          v-if="report"
          class="report-frame"
          :srcdoc="report"
          sandbox=""
          title="审计报告预览"
        ></iframe>
        <t-empty v-else description="任务收尾后自动生成审计报告（可在历史详情中导出 HTML）" />
      </div>
    </t-tab-panel>

    <t-tab-panel value="logs" label="执行日志" :destroy-on-hide="false">
      <div ref="logContainer" class="log-body">
        <template v-if="logs.length">
          <div v-for="(entry, i) in logs" :key="i" class="log-line">
            <span class="log-time">{{ formatLogTime(entry.time) }}</span>
            <span :class="['log-level', `log-level--${entry.level}`]">{{
              entry.level.toUpperCase()
            }}</span>
            <span class="log-message">{{ entry.message }}</span>
          </div>
        </template>
        <t-empty v-else description="暂无执行日志" />
      </div>
    </t-tab-panel>
  </t-tabs>
</template>

<script lang="ts" setup>
import dayjs from 'dayjs'
import { HEALTH_DIMENSIONS } from '../health-check-items'
import { HEALTH_STATUS_LABELS } from '../health-report'

const props = withDefaults(
  defineProps<{
    // eslint-disable-next-line no-undef
    items: HealthItemResult[]
    // eslint-disable-next-line no-undef
    logs: HealthLogEntry[]
    report: string | null
    /** 运行中实时视图自动滚动日志到底部 */
    autoScrollLogs?: boolean
  }>(),
  { autoScrollLogs: false }
)

// eslint-disable-next-line no-undef
const STATUS_THEMES: Record<HealthItemStatus, 'success' | 'warning' | 'danger' | 'default'> = {
  pass: 'success',
  warn: 'warning',
  fail: 'danger',
  skip: 'default'
}
const STATUS_LABELS = HEALTH_STATUS_LABELS

const tab = ref('overview')
const logContainer = ref<HTMLElement | null>(null)

/** 概览按维度分组（保持检测定义顺序） */
const itemGroups = computed(() =>
  HEALTH_DIMENSIONS.map((dimension) => ({
    dimension,
    items: props.items.filter((it) => it.dimension === dimension)
  })).filter((group) => group.items.length > 0)
)

const formatLogTime = (time: number) => dayjs(time).format('HH:mm:ss.SSS')

// 运行中日志追加时自动滚到底部（仅实时视图）
watch(
  () => props.logs.length,
  () => {
    if (!props.autoScrollLogs) return
    nextTick(() => {
      const el = logContainer.value
      if (el) el.scrollTop = el.scrollHeight
    })
  }
)
</script>

<style scoped lang="less">
.health-result {
  :deep(.t-tabs__content) {
    padding-top: 8px;
  }
}

.overview-body,
.report-body,
.log-body {
  max-height: 360px;
  overflow-y: auto;
  padding: 4px 8px;
}

.item-group {
  display: flex;
  flex-direction: column;
  gap: 4px;

  & + .item-group {
    margin-top: 12px;
  }
}

.group-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--td-text-color-secondary);
}

.item-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-container-hover);

  .item-main {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .item-tag {
    flex-shrink: 0;
  }

  .item-name {
    font-size: 13px;
    color: var(--td-text-color-primary);
  }

  .item-latency {
    margin-left: auto;
    flex-shrink: 0;
    font-size: 12px;
    color: var(--td-text-color-placeholder);
    font-variant-numeric: tabular-nums;
  }

  .item-detail {
    font-size: 12px;
    color: var(--td-text-color-secondary);
    word-break: break-all;
    padding-left: 2px;
  }
}

.report-body {
  display: flex;
  min-height: 0;
  height: calc(100% - 8px);
}

.report-frame {
  flex: 1;
  min-height: 280px;
  border: 1px solid var(--td-component-border);
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-container);
}

.log-line {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 12px;
  line-height: 1.8;
  font-variant-numeric: tabular-nums;

  .log-time {
    flex-shrink: 0;
    color: var(--td-text-color-placeholder);
  }

  .log-level {
    flex-shrink: 0;
    width: 38px;
    font-weight: 600;

    &--info {
      color: var(--td-brand-color);
    }

    &--warn {
      color: var(--td-warning-color);
    }

    &--error {
      color: var(--td-error-color);
    }
  }

  .log-message {
    color: var(--td-text-color-secondary);
    word-break: break-all;
  }
}
</style>
