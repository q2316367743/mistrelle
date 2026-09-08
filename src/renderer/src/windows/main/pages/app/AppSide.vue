<template>
  <t-aside
    style="z-index: 50"
    :width="collapsed ? '0px' : '220px'"
    :class="['sidebar', 'shrink-0', 'h-100vh', 'overflow-clip']"
  >
    <div class="h-32px pl-40px"></div>

    <div :class="['side-container', { setting: setting }]">
      <div class="side-main">
        <SideMenu :items="menuTree" />
        <t-divider size="8px" />
        <ChatList />
      </div>
      <div class="side-setting">
        <t-button
          block
          theme="default"
          variant="text"
          style="justify-content: flex-start"
          @click="handleBack"
        >
          <template #icon>
            <chevron-left-icon />
          </template>
          返回工作区
        </t-button>
        <SideMenu :items="menuSettingTree" style="margin-top: 8px" />
      </div>
    </div>

    <div class="user-menu">
      <t-divider size="1px" />
      <div class="w-220px overflow-x-hidden mt-4px">
        <UserMenu />
      </div>
    </div>
  </t-aside>
</template>

<script lang="ts" setup>
import {
  AiArticleIcon,
  AiEducationIcon,
  AppIcon,
  BookmarkIcon,
  CardIcon,
  ChatIcon,
  InternetIcon,
  LightbulbIcon,
  Palette1Icon,
  PenIcon,
  SecuredIcon,
  Setting1Icon,
  StickyNoteIcon,
  TextformatColorIcon,
  ToolsIcon,
  UserCircleIcon,
  UserIcon,
  AiImageIcon,
  ArrowLeftRight1Icon,
  Calculation1Icon,
  ChevronLeftIcon
} from 'tdesign-icons-vue-next'
import { collapsed } from '@/global/BeanFactory'
import ChatList from './components/ChatList.vue'
import UserMenu from './components/UserMenu.vue'
import SideMenu, { type SideMenuItem } from '@/components/menu/SideMenu.vue'
import { Constant } from '@/global/Constant'

const route = useRoute()
const router = useRouter()

const menuTree: SideMenuItem[] = [
  { label: Constant.name, icon: ChatIcon, to: '/new' },
  { label: '生图', icon: AiImageIcon, to: '/attachment/image' },
  {
    label: '设计',
    icon: PenIcon,
    activePaths: ['/design/detail/'],
    children: [
      { label: '设计风格', icon: Palette1Icon, to: '/design/list' },
      { label: '卡片风格', icon: StickyNoteIcon, to: '/design/card' },
      { label: '字体', icon: TextformatColorIcon, to: '/design/font' }
    ]
  },
  {
    label: '闲庭漫步',
    icon: LightbulbIcon,
    children: [
      { label: '笔记卡片', icon: CardIcon, to: '/attachment/card' },
      { label: '可用性检测工具', icon: Calculation1Icon, to: '/attachment/test' },
      { label: '模型对比检测', icon: ArrowLeftRight1Icon, to: '/attachment/compare' }
    ]
  },
  {
    label: '更多拓展',
    icon: AppIcon,
    children: [
      { label: 'Agent', icon: AiEducationIcon, to: '/agent' },
      { label: '技能', icon: LightbulbIcon, to: '/skill' },
      { label: '工具', icon: ToolsIcon, to: '/tool' }
    ]
  }
]
const menuSettingTree: SideMenuItem[] = [
  { label: '系统设置', icon: Setting1Icon, to: '/setting/global' },
  { label: '账户设置', icon: UserIcon, to: '/setting/account' },
  { label: '智能体设置', icon: AiArticleIcon, to: '/setting/default' },
  { label: '个性化', icon: UserCircleIcon, to: '/setting/personalize' },
  { label: '记忆', icon: BookmarkIcon, to: '/setting/soul' },
  { label: '模型', icon: AppIcon, to: '/setting/ai' },
  { label: '安全中心', icon: SecuredIcon, to: '/setting/secure' },
  { label: '网络设置', icon: InternetIcon, to: '/setting/network' }
]

const setting = computed(() => route.path.startsWith('/setting'))

const handleBack = () => router.push('/new')
</script>

<style scoped lang="less">
.side-container {
  position: absolute;
  top: 40px;
  left: 8px;
  bottom: 48px;
  min-width: 200px;
  width: 204px;
  max-width: 220px;

  &.setting {
    .side-main {
      left: -220px;
      right: 220px;
    }
    .side-setting {
      left: 0;
    }
  }

  .side-main {
    position: absolute;
    top: 8px;
    left: 0;
    right: 0;
    bottom: 0;
    min-width: 200px;
    overflow-x: hidden;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    transition: all 0.3s ease-in-out;
  }
  .side-setting {
    position: absolute;
    top: 8px;
    left: 220px;
    bottom: 0;
    right: 0;
    overflow-x: hidden;
    overflow-y: auto;
    transition: all 0.3s ease-in-out;
  }
}

.user-menu {
  position: absolute;
  left: 8px;
  right: 0;
  bottom: 0;
  padding: 0 8px 6px;
}
</style>
