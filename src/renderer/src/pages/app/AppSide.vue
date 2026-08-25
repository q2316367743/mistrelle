<template>
  <t-aside
    style="z-index: 50"
    :width="collapsed ? '0px' : '220px'"
    :class="['sidebar', 'shrink-0']"
  >
    <div class="h-32px pl-40px"></div>

    <div class="side-container">
      <SideMenu :items="menuTree" />
      <t-divider size="8px" />
      <ChatList />
    </div>

    <div class="user-menu">
      <div class="w-220px overflow-x-hidden">
        <t-dropdown
          trigger="click"
          placement="top"
          max-column-width="188px"
          min-column-width="188px"
        >
          <button class="menu-item" type="button">
            <user-woman-icon v-if="avatar === 'woman'" />
            <user-man-icon v-else />
            <span>{{ nickname }}</span>
          </button>
          <t-dropdown-menu>
            <t-dropdown-item
              v-for="item in settingOptions"
              :key="item.value"
              @click="handleSettingClick(item.value)"
            >
              <template #prefix-icon>
                <component :is="item.icon" />
              </template>
              {{ item.label }}
            </t-dropdown-item>
          </t-dropdown-menu>
        </t-dropdown>
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
  ChatIcon,
  InternetIcon,
  LightbulbIcon,
  Palette1Icon,
  PenIcon,
  SecuredIcon,
  Setting1Icon,
  TextformatColorIcon,
  ToolsIcon,
  UserCircleIcon,
  UserIcon,
  ComponentRadioIcon,
  AiImageIcon,
  ArrowLeftRight1Icon,
  Calculation1Icon
} from 'tdesign-icons-vue-next'
import { collapsed, isDark } from '@/global/BeanFactory'
import { useSettingAccountStore } from '@/store'
import ChatList from './components/ChatList.vue'
import SideMenu, { type SideMenuItem } from './components/SideMenu.vue'
import { Constant } from '@/global/Constant'
import UserManIcon from '@/assets/icons/UserManIcon.vue'
import UserWomanIcon from '@/assets/icons/UserWomanIcon.vue'

const router = useRouter()

const settingOptions = [
  { label: '系统设置', icon: Setting1Icon, value: 'global' },
  { label: '账户设置', icon: UserIcon, value: 'account' },
  { label: '智能体设置', icon: AiArticleIcon, value: 'default' },
  { label: '个性化', icon: UserCircleIcon, value: 'personalize' },
  { label: '记忆', icon: BookmarkIcon, value: 'soul' },
  { label: '模型', icon: AppIcon, value: 'ai' },
  { label: '安全中心', icon: SecuredIcon, value: 'secure' },
  { label: '网络设置', icon: InternetIcon, value: 'network' }
]

const menuTree: SideMenuItem[] = [
  { label: Constant.name, icon: ChatIcon, to: '/new' },
  {
    label: '设计',
    icon: PenIcon,
    activePaths: ['/design/detail/'],
    children: [
      { label: '设计风格', icon: Palette1Icon, to: '/design/list' },
      { label: '字体', icon: TextformatColorIcon, to: '/design/font' }
    ]
  },
  {
    label: '闲庭漫步',
    icon: LightbulbIcon,
    children: [
      { label: 'AI HOT', icon: ComponentRadioIcon, to: '/attachment/aihot' },
      { label: '生图', icon: AiImageIcon, to: '/attachment/image' },
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

const avatar = computed(() => useSettingAccountStore().state.avatar)
const nickname = computed(() => useSettingAccountStore().state.nickname)

const handleSettingClick = (key: string) => router.push(`/setting/${key}`)

onMounted(() => {
  console.log('plugin enter', isDark.value)
})
</script>

<style scoped lang="less">
.side-container {
  position: absolute;
  top: 40px;
  left: 0;
  right: 0;
  bottom: 48px;
  padding: 8px 8px 0;
  overflow-x: hidden;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.user-menu {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 8px;
}

.menu-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--td-comp-margin-s);
  width: calc(100% - 16px);
  min-width: 204px;
  min-height: var(--td-comp-size-m);
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
    border-color var(--fluent-transition-fast),
    box-shadow var(--fluent-transition-fast),
    color var(--fluent-transition-fast);

  &:hover {
    background: var(--fluent-item-hover);
  }

  &:focus-visible {
    box-shadow: var(--fluent-focus-ring);
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
}
</style>
