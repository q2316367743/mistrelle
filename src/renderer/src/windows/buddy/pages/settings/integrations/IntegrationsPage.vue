<template>
  <page-layout title="应用集成">
    <div class="integrations">
      <div class="intro">
        应用集成把外部软件的事件接入 mistrelle：安装内置插件后，软件事件经本地事件服务投递，
        即可在硬件页启用并配置灯态 / 屏幕状态；未集成的应用，对应硬件页的启用与配置将置灰。
      </div>
      <integration-card v-for="item in INTEGRATION_REGISTRY" :key="item.name" :item="item" />
    </div>
  </page-layout>
</template>

<script lang="ts" setup>
import IntegrationCard from './components/IntegrationCard.vue'
import { INTEGRATION_REGISTRY } from './registry'

defineOptions({ name: 'IntegrationsPage' })
</script>

<style scoped lang="less">
.integrations {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;

  .intro {
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
  }
}
</style>
