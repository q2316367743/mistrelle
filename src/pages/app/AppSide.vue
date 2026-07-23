<template>
  <t-aside
    style="z-index: 50"
    :width="collapsed ? '0px' : '220px'"
    :class="['sidebar', 'shrink-0']"
  >
    <div class="h-32px pl-40px">
      <t-tooltip content="提示词管理">
        <t-button theme="primary" shape="square" variant="text" @click="handlePromptClick">
          <template #icon>
            <ai-textformat-italic-icon />
          </template>
        </t-button>
      </t-tooltip>
      <t-tooltip content="skill">
        <t-button theme="primary" shape="square" variant="text" @click="handleSkillClick">
          <template #icon>
            <ai-book-open-icon />
          </template>
        </t-button>
      </t-tooltip>
    </div>

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
          :class="{ active: isActive(`/agent`) }"
          type="button"
          @click="goTo(`/agent`)"
        >
          <RobotIcon class="menu-icon" />
          <span>专家·工具</span>
        </button>
        <button class="menu-item" @click="toggleMore()">
          <ChatBubbleHistoryIcon class="menu-icon" />
          <span>灵感</span>
          <chevron-right-icon class="ml-auto" :style="addIconStyle" />
        </button>
        <div v-if="more" class="pl-16px">
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

        <t-divider size="1px" />

        <t-radio-group v-model="active" variant="primary-filled">
          <t-radio-button value="agent" class="w-100px flex justify-center"> 任务 </t-radio-button>
          <t-radio-button value="discussion" class="w-100px flex justify-center">
            讨论组
          </t-radio-button>
        </t-radio-group>

        <div v-if="active === 'agent'" class="menu-section">
          <button
            v-for="chat in chats"
            :key="chat.id"
            class="menu-item"
            :class="{ active: isActive(`/chat/${chat.id}`) }"
            type="button"
            @contextmenu="openChatContextmenu($event, chat)"
            @click="goTo(`/chat/${chat.id}`)"
          >
            <FolderIcon class="menu-icon" />
            <span>{{ chat.name }}</span>
          </button>
        </div>
        <div v-else-if="active === 'discussion'" class="menu-section">
          <div class="section-title">
            <span>讨论组</span>
            <t-button
              theme="primary"
              variant="text"
              shape="square"
              size="small"
              @click="openDiscussionPut()"
            >
              <template #icon>
                <add-icon />
              </template>
            </t-button>
          </div>
          <button
            v-for="item in discussions"
            :key="item.id"
            class="menu-item"
            :class="{ active: isActive(`/discussion/${item.id}`) }"
            type="button"
            @click="goTo(`/discussion/${item.id}`)"
            @contextmenu="openDiscussionContextmenu($event, item.id)"
          >
            <UsergroupIcon class="menu-icon" />
            <span>{{ item.name }}</span>
          </button>
        </div>
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
            <t-avatar image="./logo.png" size="24px" />
            <span>{{ nickname }}</span>
          </button>
          <t-dropdown-menu>
            <t-dropdown-item @click="handleSettingClick('account')">
              <template #prefix-icon>
                <user-icon />
              </template>
              账号设置
            </t-dropdown-item>
            <t-dropdown-item @click="handleSettingClick('ai')">
              <template #prefix-icon>
                <ai-icon />
              </template>
              AI 设置
            </t-dropdown-item>
            <t-dropdown-item @click="handleSettingClick('default')">
              <template #prefix-icon>
                <ai-article-icon />
              </template>
              默认设置
            </t-dropdown-item>
            <t-dropdown-item @click="handleSettingClick('network')">
              <template #prefix-icon>
                <internet-icon />
              </template>
              网络设置
            </t-dropdown-item>
          </t-dropdown-menu>
        </t-dropdown>
      </div>
    </div>
  </t-aside>
</template>
<script lang="ts" setup>
import {
  AddIcon,
  AiArticleIcon,
  AiBookOpenIcon,
  AiIcon,
  AiTextformatItalicIcon,
  ChatIcon,
  FolderIcon,
  InternetIcon,
  UserIcon,
  UsergroupIcon,
  ChatBubbleHistoryIcon,
  RobotIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  EditIcon,
  ArticleIcon
} from 'tdesign-icons-vue-next'
import { getUserProfile } from '@/utils/native'
import { collapsed, isDark } from '@/global/BeanFactory'
import { useAiDiscussionStore, useAiChatStore, useSettingAccountStore } from '@/store'
import { openDiscussionPut, openDiscussionContextmenu } from '@/pages/app/discussion-func'
import { openChatContextmenu } from '@/pages/app/chat-func'
import { useBoolState } from '@/hooks'

const router = useRouter()
const route = useRoute()

const active = ref('agent')
const [more, toggleMore] = useBoolState(false)

// 分组
const chats = computed(() => useAiChatStore().state)
const discussions = computed(() => useAiDiscussionStore().state)
const addIconStyle = computed(() => ({
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

const handlePromptClick = () => router.push('/prompt')
const handleSkillClick = () => router.push('/skill')
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
  bottom: 56px;
  padding: 8px;
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
  overflow-y: auto;
  width: 204px;
  overflow-x: hidden;
  height: 100%;
}

.menu-section,
.bottom-menu {
  display: flex;
  flex-direction: column;
  gap: var(--td-comp-margin-xs);
  padding-bottom: 8px;
  margin-top: 8px;
}

.menu-section {
  margin-top: var(--td-comp-margin-xs);
  padding-top: var(--td-comp-paddingTB-xs);
  height: calc(100%);
  overflow: auto;
}

.bottom-menu {
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

.section-title {
  padding: var(--td-comp-paddingTB-xs) var(--td-comp-paddingLR-s);
  color: var(--td-text-color-placeholder);
  font: var(--td-font-mark-small);
  display: flex;
  align-items: center;
  justify-content: space-between;
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
