<template>
  <page-layout title="额度配置">
    <div class="quota-plugins">
      <div class="toolbar">
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
      <t-alert v-if="lastQuota?.error" theme="warning" :message="lastQuota.error" />
      <div class="dir-bar">
        <t-button size="small" variant="outline" :loading="loadingPlugins" @click="refreshPlugins">
          刷新插件列表
        </t-button>
        <t-button size="small" variant="outline" @click="openPluginsDir">打开插件目录</t-button>
        <span class="dir-hint">~/.mistrelle/buddy/plugins</span>
      </div>
      <div class="plugin-list">
        <quota-plugin-card
          v-for="item in pluginRows"
          :key="item.descriptor.source + ':' + item.descriptor.key"
          :descriptor="item.descriptor"
          :enabled="item.config.enabled"
          :settings="item.config.settings"
          :disabled="saving"
          @toggle="(enabled) => patchPlugin(item, { enabled })"
          @save="(settings) => patchPlugin(item, { settings })"
        />
        <div v-if="!pluginRows.length" class="empty">
          暂无插件；把插件 .js 文件放入插件目录后点「刷新插件列表」
        </div>
      </div>
    </div>
  </page-layout>
</template>

<script lang="ts" setup>
import { RefreshIcon } from 'tdesign-icons-vue-next'
import type { QuotaPluginDescriptor } from '@common/types/quota'
import QuotaPluginCard from './components/QuotaPluginCard.vue'
import { useQuota } from './useQuota'

defineOptions({ name: 'QuotaPlugins' })

const {
  config,
  saving,
  plugins,
  loadingPlugins,
  lastQuota,
  refreshing,
  patch,
  refreshPlugins,
  openPluginsDir,
  runQuotaNow
} = useQuota()

/** 插件行：描述 + 当前配置（目录插件配置缺省 = 未启用） */
const pluginRows = computed(() => {
  if (!config.value) return []
  return plugins.value.map((descriptor) => {
    const stored =
      descriptor.source === 'builtin'
        ? config.value?.builtin[descriptor.key]
        : config.value?.external[descriptor.key]
    return {
      descriptor,
      config: { enabled: stored?.enabled ?? false, settings: stored?.settings ?? {} }
    }
  })
})

/** 刷新间隔显示（配置回读后同步） */
const interval = ref(5)
watch(
  config,
  (next) => {
    if (next) interval.value = next.intervalMinutes
  },
  { immediate: true }
)

/** 刷新间隔即改即存（main 保存后自动重启刷新定时器） */
function changeInterval(value: unknown): void {
  if (typeof value === 'number' && config.value) {
    void patch({ intervalMinutes: value })
  }
}

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString()
}

/** 修改单个插件配置（启停/settings），合并进配置后整份提交 */
function patchPlugin(
  row: { descriptor: QuotaPluginDescriptor },
  part: { enabled?: boolean; settings?: Record<string, string> }
): void {
  if (!config.value) return
  if (row.descriptor.source === 'builtin') {
    const prev = config.value.builtin[row.descriptor.key] ?? { enabled: false, settings: {} }
    void patch({ builtin: { ...config.value.builtin, [row.descriptor.key]: { ...prev, ...part } } })
    return
  }
  const prev = config.value.external[row.descriptor.key] ?? { enabled: false, settings: {} }
  void patch({ external: { ...config.value.external, [row.descriptor.key]: { ...prev, ...part } } })
}
</script>

<style scoped lang="less">
.quota-plugins {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;

  .label {
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
  }

  .refreshed-at {
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }
}

.dir-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;

  .dir-hint {
    font-family: var(--td-font-family-code);
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-placeholder);
  }
}

.plugin-list {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .empty {
    padding: 12px;
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
    background: var(--td-bg-color-secondarycontainer);
    border-radius: 6px;
  }
}
</style>
