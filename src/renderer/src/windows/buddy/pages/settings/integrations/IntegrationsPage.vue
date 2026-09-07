<template>
  <page-layout title="应用集成">
    <div class="integrations">
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
}
</style>
