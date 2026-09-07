<template>
  <div class="panel">
    <div class="panel-head">
      <div class="panel-title">当前事件状态</div>
      <div class="forward">
        <span class="label">向屏幕推送心跳</span>
        <t-switch
          :value="eventForward"
          :disabled="!config || saving"
          @change="(value) => patch({ eventForward: value === true })"
        />
      </div>
    </div>
    <div class="event-body">
      <template v-if="lastEvent">
        <span class="event-name">{{ eventLabel(lastEvent.event) }}</span>
        <span class="event-code">{{ lastEvent.event }}</span>
        <span class="event-meta">来自 {{ lastEvent.platform }} · {{ formatTime(lastEvent.at) }}</span>
      </template>
      <span v-else class="empty">暂无事件，等待外部软件投递</span>
    </div>
    <div class="hint">
      事件由外部软件（opencode 接入插件）经本地事件服务 /buddy/event 投递，映射为屏幕状态心跳（含额度快照）。
    </div>
  </div>
</template>

<script lang="ts" setup>
import { BuddyEventOptions } from '@common/types/buddyEvent'
import { useEsp32Lcd } from '../useEsp32Lcd'

defineOptions({ name: 'EventStatusPanel' })

const { config, saving, lastEvent, patch } = useEsp32Lcd()

const eventForward = computed(() => config.value?.eventForward ?? false)

function eventLabel(event: string): string {
  return BuddyEventOptions.find((opt) => opt.value === event)?.label ?? event
}

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString()
}
</script>

<style scoped lang="less">
.panel {
  padding: 16px;
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-container);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;

  .forward {
    display: flex;
    align-items: center;
    gap: 8px;

    .label {
      font: var(--td-font-body-small);
      color: var(--td-text-color-secondary);
    }
  }
}

.panel-title {
  font: var(--td-font-body-medium);
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.event-body {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
  padding: 12px;
  border-radius: 6px;
  background: var(--td-bg-color-secondarycontainer);

  .event-name {
    font: var(--td-font-body-medium);
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  .event-code {
    font-family: var(--td-font-family-code);
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-secondary);
  }

  .event-meta {
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }

  .empty {
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }
}

.hint {
  margin-top: 8px;
  font: var(--td-font-body-small);
  color: var(--td-text-color-placeholder);
}
</style>
