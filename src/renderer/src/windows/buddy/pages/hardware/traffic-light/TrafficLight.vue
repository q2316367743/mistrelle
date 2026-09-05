<template>
  <page-layout title="红绿灯">
    <div class="traffic-light">
      <serial-panel />
      <software-tabs v-if="connectedPath" />
      <software-placeholder v-else />
      <manual-light-panel v-if="debugMode" />
    </div>
  </page-layout>
</template>

<script lang="ts" setup>
import SerialPanel from './components/SerialPanel.vue'
import SoftwareTabs from './components/SoftwareTabs.vue'
import SoftwarePlaceholder from './components/SoftwarePlaceholder.vue'
import ManualLightPanel from './components/ManualLightPanel.vue'
import { useSerialLink } from '../useSerialLink'

defineOptions({ name: 'TrafficLight' })

// 调试模式开启才显示手动测试面板（开关在串口连接面板）
const { debugMode, connectedPath } = useSerialLink()
</script>

<style scoped lang="less">
.traffic-light {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}
</style>
