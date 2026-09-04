<template>
  <div class="panel">
    <div class="panel-title">软件接入</div>
    <div class="hint">同一时间只启用一个软件：启用任一软件会自动停用其它软件的事件响应。</div>
    <t-tabs :default-value="SOFTWARE_REGISTRY[0]?.name">
      <t-tab-panel
        v-for="sw in SOFTWARE_REGISTRY"
        :key="sw.name"
        :value="sw.name"
        :label="sw.label"
      >
        <div class="mt-16px">
          <component :is="PANELS[sw.name]" />
        </div>
      </t-tab-panel>
    </t-tabs>
  </div>
</template>

<script lang="ts" setup>
import type { Component } from 'vue'
import type { SoftwareName } from '@common/types/trafficLight'
import { SOFTWARE_REGISTRY } from '../softwareRegistry'
import OpencodePanel from './software/OpencodePanel.vue'

defineOptions({ name: 'SoftwareTabs' })

/**
 * 各软件的专属面板：不同软件的功能按钮/事件 UI 可能完全不同，
 * 一律独立组件（不做通用面板），新增软件时在此登记自己的面板。
 */
const PANELS: Record<SoftwareName, Component> = {
  opencode: OpencodePanel
}
</script>

<style scoped lang="less">
.panel {
  padding: 16px;
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-container);
}

.panel-title {
  margin-bottom: 12px;
  font: var(--td-font-body-medium);
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.hint {
  margin-bottom: 8px;
  font: var(--td-font-body-small);
  color: var(--td-text-color-secondary);
}
</style>
