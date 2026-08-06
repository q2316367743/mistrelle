<template>
  <t-layout class="main">
    <app-side />
    <t-content class="main-container">
      <router-view />
    </t-content>
    <div class="common-operator">
      <t-button theme="primary" shape="square" variant="text" @click="toggleCollapsed()">
        <template #icon>
          <AsideLeftIcon />
        </template>
      </t-button>
    </div>
  </t-layout>
</template>
<script lang="ts" setup>
import { toggleCollapsed } from '@/global/BeanFactory'
import { appData, dataFolder } from '@/global/Constant'
import AppSide from '@/pages/app/AppSide.vue'
import AsideLeftIcon from '@/assets/icons/AsideLeftIcon.vue'

window.preload.inject.onPluginEnter((action) => {
  // 对关键字进行处理
  console.log(action)
})

onMounted(() => {
  console.log(`插件已启动:
程序目录：${appData}
数据目录：${dataFolder}`)
})
</script>
<style scoped lang="less">
.main {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  color: var(--td-text-color-primary);
  background: var(--td-bg-color-page);

  & > .sidebar {
    display: flex;
    flex-direction: column;
    gap: var(--td-comp-margin-s);
    flex-shrink: 0;
    overflow-x: hidden;
    overflow-y: auto;
    height: calc(100vh - 16px);
    padding-top: 8px;
    padding-bottom: 8px;
  }

  & > .main-container {
    position: relative;
    height: 100%;
    width: 100%;
    background-color: var(--td-bg-color-container);
    border-radius: var(--td-radius-medium);
    overflow: hidden;
  }
}

.common-operator {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 51;
  display: flex;
  gap: 8px;
}
</style>
