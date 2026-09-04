<template>
  <div ref="container" class="compare-log-list">
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
</template>

<script lang="ts" setup>
import dayjs from 'dayjs'
import type { CompareLogEntry } from '../compare-types'

const props = withDefaults(
  defineProps<{
    logs: CompareLogEntry[]
    /** 运行中实时视图自动滚动到底部 */
    autoScroll?: boolean
  }>(),
  { autoScroll: false }
)

const container = ref<HTMLElement | null>(null)

const formatLogTime = (time: number) => dayjs(time).format('HH:mm:ss.SSS')

watch(
  () => props.logs.length,
  () => {
    if (!props.autoScroll) return
    nextTick(() => {
      const el = container.value
      if (el) el.scrollTop = el.scrollHeight
    })
  }
)
</script>

<style scoped lang="less">
.compare-log-list {
  max-height: 100%;
  overflow-y: auto;
  padding: 4px 8px;
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
