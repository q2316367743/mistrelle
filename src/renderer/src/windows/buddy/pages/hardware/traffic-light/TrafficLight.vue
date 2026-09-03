<template>
  <page-layout title="红绿灯">
    <div class="traffic-light">
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
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">灯光控制</div>
        <div class="commands">
          <t-button
            v-for="cmd in commands"
            :key="cmd.code"
            variant="outline"
            :disabled="!connectedPath"
            @click="sendCommand(cmd.code)"
          >
            <template #icon><span class="dot" :style="{ background: cmd.color }" /></template>
            {{ cmd.label }}
          </t-button>
        </div>
        <div class="commands">
          <t-button variant="outline" :disabled="!connectedPath" @click="sendCommand('off')">
            全灭
          </t-button>
        </div>
      </div>
    </div>
  </page-layout>
</template>

<script lang="ts" setup>
import { RefreshIcon } from 'tdesign-icons-vue-next'
import { useSerialLink } from '../useSerialLink'

defineOptions({ name: 'TrafficLight' })

const {
  ports,
  selectedPath,
  connectedPath,
  listing,
  refreshPorts,
  handleSelect,
  disconnect,
  sendCommand
} = useSerialLink()

/** 灯色（协议 r/g/y）与展示色（tdesign token：error=红 success=绿 warning=黄） */
const LIGHTS = [
  { key: 'r', label: '红灯', color: 'var(--td-error-color)' },
  { key: 'g', label: '绿灯', color: 'var(--td-success-color)' },
  { key: 'y', label: '黄灯', color: 'var(--td-warning-color)' }
]

/** 模式（协议 o=常亮 s=闪烁；Arduino 端另支持 h=呼吸，页面暂不提供） */
const MODES = [
  { key: 'o', label: '常亮' },
  { key: 's', label: '闪烁' }
]

/** 6 个指令按钮：灯 × 模式，协议形如 ro / gs */
const commands = LIGHTS.flatMap((light) =>
  MODES.map((mode) => ({
    code: light.key + mode.key,
    label: `${light.label}${mode.label}`,
    color: light.color
  }))
)

const portOptions = computed(() =>
  ports.value.map((p) => ({
    label: p.manufacturer ? `${p.path}（${p.manufacturer}）` : p.path,
    value: p.path
  }))
)
</script>

<style scoped lang="less">
.traffic-light {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 720px;
  padding: 16px;
}

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

.commands {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;

  & + .commands {
    margin-top: 8px;
  }
}

.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--td-text-color-placeholder);
}
</style>
