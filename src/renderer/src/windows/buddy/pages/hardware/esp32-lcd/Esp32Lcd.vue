<template>
  <page-layout title="ESP32-S3-LCD-1.28">
    <div class="esp32-lcd">
      <lcd-serial-panel />
      <template v-if="connectedPath">
        <quota-panel />
        <event-status-panel />
      </template>
      <lcd-placeholder v-else />
    </div>
  </page-layout>
</template>

<script lang="ts" setup>
import LcdSerialPanel from './components/LcdSerialPanel.vue'
import QuotaPanel from './components/QuotaPanel.vue'
import EventStatusPanel from './components/EventStatusPanel.vue'
import LcdPlaceholder from './components/LcdPlaceholder.vue'
import { useEsp32Lcd } from './useEsp32Lcd'

defineOptions({ name: 'Esp32Lcd' })

// 连接运行态来自 main 推送；未连接时下方配置区（额度/事件）不暴露，改由占位提示
const { connectedPath } = useEsp32Lcd()
</script>

<style scoped lang="less">
.esp32-lcd {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}
</style>
