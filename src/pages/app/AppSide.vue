<template>
  <t-aside
    style="z-index: 50"
    :width="collapsed ? '0px' : '220px'"
    :class="['sidebar', 'shrink-0']"
  >
    <div class="h-32px pl-40px"></div>

    <div class="side-container">
      <nav class="menu-list" aria-label="主菜单">
        <button
          class="menu-item"
          :class="{ active: isActive('/new') }"
          type="button"
          @click="goTo('/new')"
        >
          <ChatIcon class="menu-icon" />
          <span>半窗烟雨</span>
        </button>
        <button
          class="menu-item"
          :class="{ active: isStartActive('/project/') }"
          type="button"
          @click="goTo('/project/list')"
        >
          <AbilityOpenIcon class="menu-icon" />
          <span>项目</span>
        </button>
        <button class="menu-item" @click="toggleNote()">
          <ChatBubbleHistoryIcon class="menu-icon" />
          <span>灵感</span>
          <chevron-right-icon class="ml-auto" :style="noteIconStyle" />
        </button>
        <div v-if="note" class="pl-16px">
          <button
            :class="['menu-item', { active: isActive('/note/ego') }]"
            @click="handleNoteClick('ego')"
          >
            <edit-icon class="menu-icon" />
            <span>自我</span>
          </button>
          <button
            :class="['menu-item', { active: isActive('/note/id') }]"
            @click="handleNoteClick('id')"
          >
            <article-icon class="menu-icon" />
            <span>本我</span>
          </button>
          <button
            :class="['menu-item', { active: isStartActive('/note/superego/') }]"
            @click="handleNoteClick('superego/home')"
          >
            <usergroup-icon class="menu-icon" />
            <span>超我</span>
          </button>
        </div>
        <button class="menu-item" type="button" @click="toggleMore()">
          <app-icon class="menu-icon" />
          <span>更多拓展</span>
          <chevron-right-icon class="ml-auto" :style="moreIconStyle" />
        </button>
        <div v-if="more" class="pl-16px">
          <button
            class="menu-item"
            :class="{ active: isActive(`/agent`) }"
            type="button"
            @click="goTo(`/agent`)"
          >
            <AiEducationIcon class="menu-icon" />
            <span>Agent</span>
          </button>
          <button :class="['menu-item', { active: isActive('/skill') }]" @click="goTo(`/skill`)">
            <LightbulbIcon class="menu-icon" />
            <span>技能</span>
          </button>
          <button :class="['menu-item', { active: isActive(`/tool`) }]" @click="goTo(`/tool`)">
            <tools-icon class="menu-icon" />
            <span>工具</span>
          </button>
        </div>

        <t-divider size="1px" />

        <t-radio-group v-model="active" variant="primary-filled">
          <t-radio-button value="agent" class="w-100px flex justify-center"> 任务 </t-radio-button>
          <t-radio-button value="discussion" class="w-100px flex justify-center">
            讨论组
          </t-radio-button>
        </t-radio-group>

        <ChatList v-if="active === 'agent'" />
        <DiscussionList v-else-if="active === 'discussion'" />
      </nav>
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
            <t-avatar image="./logo.png" size="24px" shape="circle" />
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
  AiIcon,
  ChatIcon,
  InternetIcon,
  UserIcon,
  UsergroupIcon,
  ChatBubbleHistoryIcon,
  ChevronRightIcon,
  EditIcon,
  ArticleIcon,
  Setting1Icon,
  SecuredIcon,
  AppIcon,
  ToolsIcon,
  AiEducationIcon,
  LightbulbIcon,
  AbilityOpenIcon
} from 'tdesign-icons-vue-next'
import { collapsed, isDark } from '@/global/BeanFactory'
import { useSettingAccountStore } from '@/store'
import { useBoolState } from '@/hooks'
import ChatList from './components/ChatList.vue'
import DiscussionList from './components/DiscussionList.vue'

const router = useRouter()
const route = useRoute()

const active = ref('agent')
const [note, toggleNote] = useBoolState(false)
const [more, toggleMore] = useBoolState(false)

const settingOptions = [
  { label: '系统设置', icon: Setting1Icon, value: 'global' },
  { label: '账户设置', icon: UserIcon, value: 'account' },
  { label: '智能体设置', icon: AiArticleIcon, value: 'default' },
  { label: '个性化～', icon: AiIcon, value: 'ai' },
  { label: '记忆～', icon: AiIcon, value: 'ai' },
  { label: '模型', icon: AppIcon, value: 'ai' },
  { label: '安全中心', icon: SecuredIcon, value: 'secure' },
  { label: '网络设置', icon: InternetIcon, value: 'network' }
]

const noteIconStyle = computed(() => ({
  transform: note.value ? 'rotate(90deg)' : '',
  transition: 'all 200ms ease-in-out'
}))
const moreIconStyle = computed(() => ({
  transform: more.value ? 'rotate(90deg)' : '',
  transition: 'all 200ms ease-in-out'
}))
const nickname = computed(() => useSettingAccountStore().state.nickname)

const isActive = (path: string) => route.path === path
const isStartActive = (path: string) => route.path.startsWith(path)

const goTo = (path: string) => {
  if (route.path !== path) {
    router.push(path)
  }
}

const handleSettingClick = (key: string) => router.push(`/setting/${key}`)
const handleNoteClick = (key: string) => router.push(`/note/${key}`)

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
  padding: 8px;
  padding-bottom: 0;
  overflow-x: hidden;
  overflow-y: auto;
}

.search-button,
.menu-item {
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
}

.menu-list {
  display: flex;
  flex-direction: column;
  gap: var(--td-comp-margin-xs);
  min-height: 0;
  width: 204px;
  height: 100%;
  overflow: hidden;
}

.bottom-menu {
  display: flex;
  flex-direction: column;
  gap: var(--td-comp-margin-xs);
  margin-top: 8px;
  padding-top: var(--td-comp-paddingTB-s);
  border-top: 1px solid var(--fluent-sidebar-border);
  width: 204px;
  overflow-x: hidden;
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

  &.active {
    color: var(--td-text-color-brand);
    background: var(--fluent-item-selected);
    border-color: var(--fluent-sidebar-border);

    &:hover {
      background: var(--fluent-item-selected);
    }

    &::before {
      background: var(--fluent-item-selected-border);
    }
  }
}

.menu-icon {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
}
</style>
