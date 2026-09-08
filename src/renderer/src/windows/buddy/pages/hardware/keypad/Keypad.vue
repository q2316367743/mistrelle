<template>
  <page-layout title="小键盘">
    <div class="keypad">
      <t-alert v-if="showPermissionAlert" theme="warning" :closeBtn="true" @close="ignorePermission = true">
        <template #message>
          系统级模拟按键需要「辅助功能」权限：请在
          系统设置 → 隐私与安全性 → 辅助功能
          中勾选本应用，授权后重新触发按键即可生效
        </template>
      </t-alert>
      <serial-panel />
      <keypad-keys v-if="connectedPath" />
      <keypad-placeholder v-else />
    </div>
  </page-layout>
</template>

<script lang="ts" setup>
import SerialPanel from './components/SerialPanel.vue'
import KeypadKeys from './components/KeypadKeys.vue'
import KeypadPlaceholder from './components/KeypadPlaceholder.vue'
import { useKeypad } from './useKeypad'

defineOptions({ name: 'Keypad' })

// 连接运行态来自 main 推送；macOS 未授权时顶部提示引导（Windows 恒为已授权不显示）
const { connectedPath, accessibilityGranted } = useKeypad()

/** 用户手动关闭提示后不再显示（本次会话内） */
const ignorePermission = ref(false)

const showPermissionAlert = computed(() => !accessibilityGranted.value && !ignorePermission.value)
</script>

<style scoped lang="less">
.keypad {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}
</style>
