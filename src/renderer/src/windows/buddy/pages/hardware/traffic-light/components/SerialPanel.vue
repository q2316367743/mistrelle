<template>
  <div class="panel">
    <div class="panel-title">串口连接</div>
    <div class="serial-bar">
      <t-select
        v-model="selectedPath"
        class="serial-select"
        :options="portOptions"
        :loading="listing"
        clearable
        filterable
        placeholder="选择串口（选择后自动连接）"
        @change="handleSelect"
      />
      <t-button variant="outline" :loading="listing" @click="refreshPorts">
        <template #icon><refresh-icon /></template>
        刷新
      </t-button>
      <t-tag v-if="connectedPath" theme="success" variant="light"
        >已连接 {{ connectedPath }}</t-tag
      >
      <t-tag v-else theme="default" variant="light">未连接</t-tag>
      <t-button v-if="connectedPath" variant="outline" @click="disconnect">断开</t-button>
      <t-button
        variant="outline"
        :theme="debugMode ? 'primary' : 'default'"
        @click="debugMode = !debugMode"
      >
        {{ debugMode ? '退出调试' : '调试模式' }}
      </t-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { RefreshIcon } from 'tdesign-icons-vue-next'
import { useSerialLink } from '../../useSerialLink'
import { useTrafficLight } from '../useTrafficLight'

defineOptions({ name: 'SerialPanel' })

const {
  ports,
  selectedPath,
  connectedPath,
  listing,
  debugMode,
  refreshPorts,
  handleSelect,
  disconnect
} = useSerialLink()
const { config } = useTrafficLight()

const portOptions = computed(() =>
  ports.value.map((p) => ({
    label: p.manufacturer ? `${p.path}（${p.manufacturer}）` : p.path,
    value: p.path
  }))
)

// 预选上次端口（仅反映记忆；连接由 main 启动时自动完成，未连上时用户手动选择）
watch(
  ports,
  () => {
    const last = config.value?.lastPort
    if (last && !selectedPath.value && ports.value.some((p) => p.path === last)) {
      selectedPath.value = last
    }
  },
  { immediate: true }
)
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

.serial-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;

  .serial-select {
    width: 280px;
  }
}
</style>
