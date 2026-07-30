<template>
  <page-layout title="系统设置">
  </page-layout>
</template>
<script lang="ts" setup>
import { useSettingGlobalStore } from '@/store'

const { state } = toRefs(useSettingGlobalStore())
</script>
<style scoped lang="less">
.setting-global {
  padding: 8px 16px 16px;
}
</style>
