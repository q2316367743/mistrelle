<template>
  <t-layout class="main">
    <div class="window-drag-region"></div>
    <t-aside :width="collapsed ? '0px' : '232px'" class="app-aside">
      <div class="side-container">
        <button
          v-for="item in menus"
          :key="item.to"
          type="button"
          :class="['menu-item', { 'is-active': route.path.startsWith(item.to) }]"
          @click="router.push(item.to)"
        >
          <component :is="item.icon" />
          <span>{{ item.label }}</span>
        </button>
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
import { TrafficIcon } from 'tdesign-icons-vue-next'
import AsideLeftIcon from '@/assets/icons/AsideLeftIcon.vue'
import { useColorMode, useTitlePadding } from '@/hooks'
import { collapsed, toggleCollapsed } from '@/global/BeanFactory'

// 伙伴窗口独立主题跟随（document theme-mode 初始化在 useColorMode 内）
useColorMode()

const route = useRoute()
const router = useRouter()
// 声明伙伴窗口仅「收起」单按钮形态：窗口内共享组件（PageLayout 等）折叠态标题起点按此预留
const { l1 } = useTitlePadding({ kind: 'buddy' })
const operatorLeft = computed(() => `${l1}px`)

/** 侧栏折叠（伙伴窗口本地状态，不与主窗口共享持久化） */

/** 硬件功能菜单（后续拓展往这里加） */
const menus = [{ label: '红绿灯', icon: TrafficIcon, to: '/hardware/traffic-light' }]
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
  padding: 40px 8px 8px;
}

.menu-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--td-comp-margin-s);
  width: 100%;
  min-height: var(--td-comp-size-m);
  margin-bottom: 4px;
  padding: 0 var(--td-comp-paddingLR-s);
  color: var(--td-text-color-primary);
  font: var(--td-font-body-medium);
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--td-radius-small);
  outline: none;
  cursor: pointer;
  transition:
    background var(--fluent-transition-fast),
    box-shadow var(--fluent-transition-fast);

  &:hover {
    background: var(--fluent-item-hover);
  }

  &:focus-visible {
    box-shadow: var(--fluent-focus-ring);
  }

  &.is-active {
    background: var(--fluent-item-selected);
  }

  &::before {
    position: absolute;
    left: 0;
    width: 3px;
    height: 18px;
    content: '';
    background: transparent;
    border-radius: var(--td-radius-round);
    transition: background var(--fluent-transition-fast);
  }

  &.is-active::before {
    background: var(--fluent-item-selected-border);
  }
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
