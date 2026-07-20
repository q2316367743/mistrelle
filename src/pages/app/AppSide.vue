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
    <div class="h-40px grid grid-cols-3 gap-8px px-8px w-204px overflow-x-hidden">
      <t-tooltip content="碎碎念">
        <button
          :class="['menu-item', 'search-button', { active: isActive('/note/ego') }]"
          @click="handleNoteClick('ego')"
        >
          <span>自我</span>
        </button>
      </t-tooltip>
      <t-tooltip content="感悟">
        <button
          :class="['menu-item', 'search-button', { active: isActive('/note/id') }]"
          @click="handleNoteClick('id')"
        >
          <span>本我</span>
        </button>
      </t-tooltip>
      <t-tooltip content="内心">
        <button
          :class="['menu-item', 'search-button', { active: isStartActive('/note/superego/') }]"
          @click="handleNoteClick('superego/home')"
        >
          <span>超我</span>
        </button>
      </t-tooltip>
    </div>

    <div class="side-container">
      <nav class="menu-list" aria-label="主菜单">
        <button
          class="menu-item"
          :class="{ active: isActive('/new/0') }"
          type="button"
          @click="goTo('/new/0')"
        >
          <ChatIcon class="menu-icon" />
          <span>半窗烟雨</span>
        </button>

        <div class="menu-section">
          <div class="section-title">
            <span>我的 Agent</span>
            <t-button
              theme="primary"
              variant="text"
              shape="square"
              size="small"
              @click="openAgentPut()"
            >
              <template #icon>
                <add-icon />
              </template>
            </t-button>
          </div>
          <button
            v-for="group in groups"
            :key="group.id"
            class="menu-item"
            :class="{
              active:
                isActive(`/agent/${group.id}`) ||
                isActive(`/new/${group.id}`) ||
                isStartActive(`/chat/${group.id}/`)
            }"
            type="button"
            @contextmenu="openAgentContextmenu($event, group.id)"
            @click="goTo(`/agent/${group.id}`)"
          >
            <FolderIcon class="menu-icon" />
            <span>{{ group.name }}</span>
          </button>
        </div>

        <div class="section-title">聊天</div>
        <button
          v-for="chat in chats"
          :key="chat.id"
          class="menu-item"
          :class="{ active: isActive(`/chat/${chat.id}`) }"
          type="button"
          @contextmenu="openChatContextmenu($event, '0', chat.id)"
          @click="goTo(`/chat/0/${chat.id}`)"
        >
          <FolderIcon class="menu-icon" />
          <span>{{ chat.name }}</span>
        </button>
      </nav>

      <div class="bottom-menu">
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
        >
          <UsergroupIcon class="menu-icon" />
          <span>{{ item.name }}</span>
        </button>
      </div>
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
            <t-avatar :image="profile.avatar" size="24px" />
            <span>{{ profile.nickname }}</span>
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
  AiIcon, AiTextformatItalicIcon,
  ChatIcon,
  FolderIcon,
  InternetIcon,
  UserIcon,
  UsergroupIcon
} from 'tdesign-icons-vue-next'
import { getUserProfile } from '@/utils/native'
import { collapsed, isDark } from '@/global/BeanFactory'
import { useAiChatStore, useAiDiscussionStore, useAiAgentStore } from '@/store'
import { openAgentContextmenu, openAgentPut } from '@/pages/app/agent-func'
import { openDiscussionPut } from '@/pages/app/discussion-func'
import { openChatContextmenu } from '@/pages/app/chat-func'

const router = useRouter()
const route = useRoute()

const profile = getUserProfile()

// 分组
const groups = computed(() => useAiAgentStore().state)
const chats = computed(() => useAiChatStore().state)
const discussions = computed(() => useAiDiscussionStore().state)

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
  top: 88px;
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
  min-height: var(--td-comp-size-xl);
  padding: 0 var(--td-comp-paddingLR-s);
  color: var(--td-text-color-primary);
  font: var(--td-font-body-medium);
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--fluent-radius-smooth);
  outline: none;
  cursor: pointer;
  transition:
    background var(--fluent-transition-fast),
    border-color var(--fluent-transition-fast),
    box-shadow var(--fluent-transition-fast),
    color var(--fluent-transition-fast);

  &:hover {
    background: var(--fluent-item-hover) !important;
  }

  &:focus-visible {
    box-shadow: var(--fluent-focus-ring);
  }
}

.search-button {
  color: var(--td-text-color-secondary);
  background: var(--td-bg-color-container);
  border-color: var(--td-component-border);
  box-shadow: var(--fluent-elevation-1);
  overflow-x: hidden;
  width: 62px;
  min-width: 62px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
}

.menu-list {
  display: flex;
  flex-direction: column;
  gap: var(--td-comp-margin-xs);
  min-height: 0;
  overflow-y: auto;
  width: 204px;
  overflow-x: hidden;
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
  border-top: 1px solid var(--fluent-sidebar-border);
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
