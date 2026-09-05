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
        placeholder="选择串口"
        @change="changeSelection"
      />
      <t-button variant="outline" :loading="listing" @click="refreshPorts">
        <template #icon><refresh-icon /></template>
        刷新
      </t-button>
      <t-tag v-if="connectedPath" theme="success" variant="light"
        >已连接 {{ connectedPath }}</t-tag
      >
      <t-tag v-else theme="default" variant="light">未连接</t-tag>
      <t-button
        variant="outline"
        :theme="showDisconnect ? 'danger' : 'primary'"
        :loading="connecting"
        :disabled="!selectedPath && !connectedPath"
        @click="toggleConnection"
      >
        {{ showDisconnect ? '断开' : '连接' }}
      </t-button>
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
  connecting,
  debugMode,
  refreshPorts,
  connect,
  changeSelection,
  disconnect
} = useSerialLink()
const { config } = useTrafficLight()

/**
 * 按钮语义：
 * - 下拉选中即连接中的端口，或已连接但未选端口 → 显示「断开」（断开当前连接）
 * - 其余情况（未连 / 选了新端口）→ 显示「连接」，open 覆盖旧连接
 */
const showDisconnect = computed(
  () => !!connectedPath.value && (connectedPath.value === selectedPath.value || !selectedPath.value)
)

/** 连接/断开切换 */
function toggleConnection(): void {
  if (showDisconnect.value) {
    void disconnect()
    return
  }
  if (selectedPath.value) void connect(selectedPath.value)
}

const portOptions = computed(() =>
  ports.value.map((p) => ({
    label: p.manufacturer ? `${p.path}（${p.manufacturer}）` : p.path,
    value: p.path
  }))
)

// 预选上次端口（仅反映记忆；main 启动时已按 lastPort 自动连接，未连上时用户点「连接」手动连）
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
