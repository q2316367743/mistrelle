<template>
  <page-layout title="额度配置">
    <div class="quota-plugins">
      <div class="intro">
        额度插件是独立公共能力，为各类硬件设备（如 ESP32 LCD 屏幕）提供余额快照：内置插件随应用版本更新、可随时关闭；
        第三方插件为 definePlugin 契约的单文件 .js，放入插件目录后刷新即可安装，替换文件即更新。
      </div>
      <div class="dir-bar">
        <t-button size="small" variant="outline" :loading="loadingPlugins" @click="refreshPlugins">
          <template #icon><refresh-icon /></template>
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

const { config, saving, plugins, loadingPlugins, patch, refreshPlugins, openPluginsDir } =
  useQuota()

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

.intro {
  padding: 8px 12px;
  border-radius: 6px;
  font: var(--td-font-body-small);
  color: var(--td-text-color-secondary);
  background: var(--td-bg-color-secondarycontainer);
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
