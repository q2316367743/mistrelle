<template>
  <t-layout class="main">
    <div class="window-drag-region"></div>
    <app-side />
    <t-content class="main-container">
      <router-view v-slot="{ Component }">
        <keep-alive :include="keepAliveNames">
          <component :is="Component" />
        </keep-alive>
      </router-view>
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
  </t-layout>
</template>
<script lang="ts" setup>
import { collapsed, toggleCollapsed } from '@/global/BeanFactory'
import { appData, dataFolder } from '@/global/Constant'
import { useTitlePadding } from '@/hooks'
import { initMemorySystem } from '@/windows/main/modules/memory'
import { startAppUpdater } from '@/windows/main/modules/updater/startAppUpdater'
import AppSide from '@/windows/main/pages/app/AppSide.vue'
import AsideLeftIcon from '@/assets/icons/AsideLeftIcon.vue'
import { ChatAddIcon } from 'tdesign-icons-vue-next'

const route = useRoute()
const router = useRouter()

// 主窗口含「收起 + 新建」两按钮，声明 main 形态供共享组件（PageLayout 等）预留折叠标题起点
const { l1 } = useTitlePadding({ kind: 'main' })
const operatorLeft = computed(() => `${l1}px`)

const gotoNew = () => {
  router.push('/new')
}

const showChatAdd = computed(() => {
  if (route.path.startsWith('/design/detail/')) return false

  return true
})

/** keep-alive 缓存的组件名：新建聊天页 + 可用性检测 / 模型对比工具页保活（检测跨页面切换不中断） */
const keepAliveNames = ['PageNew', 'ExtendTestPage', 'ExtendComparePage', 'DesignListPage']

onMounted(() => {
  console.log(`插件已启动:
程序目录：${appData}
数据目录：${dataFolder}`)
  // 记忆系统：长期记忆合并的启动检查 + 每小时跨天检查（会话提取钩子在 ChatSessionManager 内）
  initMemorySystem()
  void startAppUpdater()
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
  left: v-bind(operatorLeft);
  z-index: 60;
  display: flex;
  gap: 8px;
  -webkit-app-region: no-drag;
}
</style>
