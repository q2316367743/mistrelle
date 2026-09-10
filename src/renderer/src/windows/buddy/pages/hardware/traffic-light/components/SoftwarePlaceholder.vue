<template>
  <div class="panel">
    <div class="panel-head">
      <div class="panel-title">软件接入</div>
      <t-tag theme="default" variant="light" size="small">未连接</t-tag>
    </div>
    <div class="placeholder">
      <div class="placeholder__icon">
        <usb-icon />
      </div>
      <div class="placeholder__title">连接串口后即可配置软件接入</div>
      <div class="placeholder__desc">
        将软件事件（回复、执行工具、出错等）映射为信号灯的常亮、闪烁或呼吸
      </div>
      <div class="placeholder__softwares">
        <span class="placeholder__softwares-label">可接入的软件</span>
        <div class="placeholder__softwares-list">
          <div
            v-for="sw in SOFTWARE_REGISTRY"
            :key="sw.name"
            class="software-chip"
          >
            <component :is="SOFTWARE_ICONS[sw.name]" />
            <span>{{ sw.label }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { CodeIcon, StarIcon, RobotIcon, TerminalIcon, UsbIcon } from 'tdesign-icons-vue-next'
import type { Component } from 'vue'
import type { SoftwareName } from '@common/types/trafficLight'
import { SOFTWARE_REGISTRY } from '../softwareRegistry'

defineOptions({ name: 'SoftwarePlaceholder' })

/** 各软件的默认图标（占位 chips 用，与软件面板组件一一对应） */
const SOFTWARE_ICONS: Record<SoftwareName, Component> = {
  opencode: CodeIcon,
  zcode: TerminalIcon,
  claude: StarIcon,
  codex: RobotIcon
}
</script>

<style scoped lang="less">
.panel {
  padding: 16px;
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-container);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.panel-title {
  font: var(--td-font-body-medium);
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28px 16px 24px;
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-secondarycontainer);

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: var(--td-radius-circle);
    color: var(--td-text-color-anti);
    font-size: 28px;
    background: var(--fluent-gradient-primary);
    box-shadow: var(--fluent-elevation-2);
  }

  &__title {
    margin-top: 16px;
    font: var(--td-font-title-medium);
    color: var(--td-text-color-primary);
  }

  &__desc {
    max-width: 420px;
    margin-top: 8px;
    font: var(--td-font-body-small);
    line-height: 20px;
    text-align: center;
    color: var(--td-text-color-secondary);
  }

  &__softwares {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 20px;

    &-label {
      font: var(--td-font-body-small);
      color: var(--td-text-color-placeholder);
    }

    &-list {
      display: flex;
      gap: 8px;
      margin-top: 10px;
    }
  }
}

.software-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: var(--td-radius-round);
  font: var(--td-font-body-small);
  color: var(--td-text-color-primary);
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-stroke);

  :deep(svg) {
    font-size: 16px;
    color: var(--td-brand-color);
  }
}
</style>
