<template>
  <div class="panel">
    <div class="panel-head">
      <div class="panel-title">按键绑定</div>
      <t-tag theme="default" variant="light" size="small">模拟为系统级组合键</t-tag>
    </div>
    <div class="keys">
      <keypad-key-card v-for="id in KEY_IDS" :key="id" :key-id="id" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import KeypadKeyCard from './KeypadKeyCard.vue'

defineOptions({ name: 'KeypadKeys' })

/** 页面当前展示的键位（设备支持任意键数，行协议键位超出仍会点亮/模拟，仅不在卡片列表内） */
const KEY_IDS = ['1', '2', '3', '4', '5', '6']
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

.keys {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}
</style>
