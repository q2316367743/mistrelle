<template>
  <t-layout class="main">
    <div class="window-drag-region"></div>
    <t-aside :width="collapsed ? '0px' : '232px'" class="app-aside">
      <div class="side-container">
        <SideMenu :items="menus" />
      </div>
    </t-aside>
    <t-content class="main-container">
      <router-view />
    </t-content>
    <div class="common-operator">
      <t-button theme="default" shape="square" variant="text" @click="toggleCollapsed()">
        <template #icon>
          <AsideLeftIcon />
        </template>
      </t-button>
    </div>
  </t-layout>
</template>
<script lang="ts" setup>
import { KeyboardIcon, SettingIcon, TrafficIcon, TvIcon } from 'tdesign-icons-vue-next'
import AsideLeftIcon from '@/assets/icons/AsideLeftIcon.vue'
import SideMenu, { type SideMenuItem } from '@/components/menu/SideMenu.vue'
import { useColorMode, useTitlePadding } from '@/hooks'
import { collapsed, toggleCollapsed } from '@/global/BeanFactory'

// 伙伴窗口独立主题跟随（document theme-mode 初始化在 useColorMode 内）
useColorMode()

// 声明伙伴窗口仅「收起」单按钮形态：窗口内共享组件（PageLayout 等）折叠态标题起点按此预留
const { l1 } = useTitlePadding({ kind: 'buddy' })
const operatorLeft = computed(() => `${l1}px`)

/** 侧栏折叠（伙伴窗口本地状态，不与主窗口共享持久化） */

/** 侧栏菜单（硬件功能 + 设置；后续拓展往这里加） */
const menus: SideMenuItem[] = [
  { label: '红绿灯', icon: TrafficIcon, to: '/hardware/traffic-light', match: 'prefix' },
  { label: 'ESP32-S3-LCD-1.28', icon: TvIcon, to: '/hardware/esp32-lcd', match: 'prefix' },
  { label: '小键盘', icon: KeyboardIcon, to: '/hardware/keypad', match: 'prefix' },
  {
    label: '设置',
    icon: SettingIcon,
    activePaths: ['/settings/nc'],
    children: [
      { label: '应用集成', to: '/settings/integrations' },
      { label: '额度配置', to: '/settings/quota' }
    ]
  }
]
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

.app-aside {
  height: 100vh;
  overflow-x: hidden;
  overflow-y: auto;
  flex-shrink: 0;
}

.side-container {
  width: 216px;
  padding: 48px 8px 8px;
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
