<template>
  <page-layout title="应用集成">
    <div class="integrations">
      <t-tabs :default-value="INTEGRATION_REGISTRY[0]?.name">
        <t-tab-panel
          v-for="item in INTEGRATION_REGISTRY"
          :key="item.name"
          :value="item.name"
          :lazy="true"
        >
          <template #label>
            <span class="tab-label" :data-status="statusOf(item.name)">
              <span class="tab-dot" />
              {{ item.label }}
            </span>
          </template>
          <integration-panel :item="item" />
        </t-tab-panel>
      </t-tabs>
    </div>
  </page-layout>
</template>

<script lang="ts" setup>
import IntegrationPanel from './components/IntegrationPanel.vue'
import { INTEGRATION_REGISTRY } from './registry'
import { useIntegrations } from './useIntegrations'

defineOptions({ name: 'IntegrationsPage' })

/** 页签状态点数据源（与硬件页门控共用同一份检测状态；未检测 = 灰点） */
const { statusOf } = useIntegrations()
</script>

<style scoped lang="less">
.integrations {
  padding: 16px;
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;

  .tab-dot {
    width: 6px;
    height: 6px;
    border-radius: var(--td-radius-circle);
    background: var(--td-text-color-placeholder);
  }

  &[data-status='ready'] .tab-dot {
    background: var(--td-success-color-7);
  }

  &[data-status='outdated'] .tab-dot {
    background: var(--td-warning-color-7);
  }
}
</style>
