<template>
  <page-layout title="ESP32-S3-LCD-1.28">
    <div class="esp32-lcd">
      <lcd-serial-panel />
      <quota-panel />
      <event-status-panel />
    </div>
  </page-layout>
</template>

<script lang="ts" setup>
import LcdSerialPanel from './components/LcdSerialPanel.vue'
import QuotaPanel from './components/QuotaPanel.vue'
import EventStatusPanel from './components/EventStatusPanel.vue'

defineOptions({ name: 'Esp32Lcd' })
</script>

<style scoped lang="less">
.esp32-lcd {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}
</style>
