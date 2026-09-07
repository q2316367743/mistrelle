<template>
  <div class="panel">
    <div class="panel-head">
      <div class="panel-title">额度快照</div>
      <t-link theme="primary" @click="goPlugins">插件管理</t-link>
    </div>
    <div class="quota-toolbar">
      <span class="label">自动刷新间隔</span>
      <t-input-number
        :value="interval"
        :min="1"
        :max="1440"
        :step="1"
        theme="column"
        suffix="分钟"
        :disabled="saving"
        @change="changeInterval"
      />
      <t-button variant="outline" :loading="refreshing" @click="runQuotaNow">
        <template #icon><refresh-icon /></template>
        立即刷新
      </t-button>
      <span v-if="lastQuota" class="refreshed-at">上次刷新 {{ formatTime(lastQuota.at) }}</span>
    </div>
    <div class="snapshot">
      <t-alert v-if="lastQuota?.error" theme="warning" :message="lastQuota.error" />
      <div v-for="item in lastQuota?.items ?? []" :key="item.label" class="snapshot-row">
        <span class="label">{{ item.label }}</span>
        <span class="value">
          {{ item.value }}<template v-if="item.screenPct != null"> ({{ item.screenPct }}%)</template>
        </span>
      </div>
      <div v-if="!lastQuota?.items.length" class="empty">暂无数据</div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { RefreshIcon } from 'tdesign-icons-vue-next'
import { useRouter } from 'vue-router'
import { useQuota } from '../../../plugins/quota/useQuota'

defineOptions({ name: 'QuotaPanel' })

const router = useRouter()
const { config, saving, lastQuota, refreshing, patch, runQuotaNow } = useQuota()

const interval = ref(5)

// 配置回读后同步间隔显示
watch(
  config,
  (next) => {
    if (next) interval.value = next.intervalMinutes
  },
  { immediate: true }
)

/** 间隔即改即存（main 保存后自动重启刷新定时器） */
function changeInterval(value: unknown): void {
  if (typeof value === 'number' && config.value) {
    void patch({ intervalMinutes: value })
  }
}

/** 插件配置在独立页面操作 */
function goPlugins(): void {
  void router.push('/plugins/quota')
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
  margin-bottom: 12px;
}

.panel-title {
  font: var(--td-font-body-medium);
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.quota-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;

  .label {
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
  }

  .refreshed-at {
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }
}

.snapshot {
  padding: 12px;
  border-radius: 6px;
  background: var(--td-bg-color-secondarycontainer);

  .snapshot-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    padding: 4px 0;

    .label {
      font: var(--td-font-body-small);
      color: var(--td-text-color-secondary);
    }

    .value {
      font-family: var(--td-font-family-code);
      font-size: var(--td-font-size-body-small);
      color: var(--td-text-color-primary);
    }
  }

  .empty {
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }
}
</style>
