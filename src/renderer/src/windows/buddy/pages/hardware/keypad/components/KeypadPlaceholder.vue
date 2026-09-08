<template>
  <div class="panel">
    <div class="panel-head">
      <div class="panel-title">按键绑定</div>
      <t-tag theme="default" variant="light" size="small">未连接</t-tag>
    </div>
    <div class="placeholder">
      <div class="placeholder__icon">
        <keyboard-icon />
      </div>
      <div class="placeholder__title">连接串口后即可配置按键绑定</div>
      <div class="placeholder__desc">
        小键盘按键（1,on / 1,off 行协议）可模拟为系统级组合键（如 Ctrl+Shift+F13），
        其他应用与系统快捷键均可响应；未绑定的按键仅点亮状态
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { KeyboardIcon } from 'tdesign-icons-vue-next'

defineOptions({ name: 'KeypadPlaceholder' })
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
    max-width: 460px;
    margin-top: 8px;
    font: var(--td-font-body-small);
    line-height: 20px;
    text-align: center;
    color: var(--td-text-color-secondary);
  }
}
</style>
