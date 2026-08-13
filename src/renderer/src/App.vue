<template>
  <t-layout class="main">
    <div class="window-drag-region"></div>
    <app-side />
    <t-content class="main-container">
      <router-view />
    </t-content>
    <div class="common-operator">
      <t-button theme="default" shape="square" variant="text" @click="toggleCollapsed()">
        <template #icon>
          <AsideLeftIcon />
        </template>
      </t-button>
      <t-button
        v-if="collapsed && showChatAdd"
        theme="default"
        shape="square"
        variant="text"
        @click="gotoNew()"
      >
        <template #icon>
          <chat-add-icon />
        </template>
      </t-button>
    </div>
    <VideoExportOverlay />
  </t-layout>
</template>
<script lang="ts" setup>
import { collapsed, toggleCollapsed } from '@/global/BeanFactory'
import { appData, dataFolder } from '@/global/Constant'
import AppSide from '@/pages/app/AppSide.vue'
import AsideLeftIcon from '@/assets/icons/AsideLeftIcon.vue'
import VideoExportOverlay from '@/components/canvas/VideoExportOverlay.vue'
import { ChatAddIcon } from 'tdesign-icons-vue-next'

const route = useRoute()
const router = useRouter()

const gotoNew = () => {
  router.push('/new')
}

const showChatAdd = computed(() => {
  if (route.path.startsWith('/design')) return false

  return true
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
  user-select: unset !important;

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
    height: 100vh;
    width: 100%;
    background-color: var(--td-bg-color-container);
    border-radius: var(--td-radius-medium);
    overflow: hidden;
  }
}

.window-drag-region {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 48px;
  z-index: 52;
  -webkit-app-region: drag;
}

.common-operator {
  position: fixed;
  top: 8px;
  left: 76px;
  z-index: 60;
  display: flex;
  gap: 8px;
  -webkit-app-region: no-drag;
}
</style>
