<template>
  <div class="panel">
    <div class="panel-title">手动测试</div>
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
</template>

<script lang="ts" setup>
import { useSerialLink } from '../../useSerialLink'

defineOptions({ name: 'ManualLightPanel' })

const { connectedPath, sendCommand } = useSerialLink()

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
