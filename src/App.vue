<template>
  <t-layout class="main">
    <t-aside
      style="z-index: 50"
      :width="collapsed ? '0px' : '220px'"
      :class="['sidebar', 'shrink-0']"
    >
      <button class="search-button mx-8px" type="button" @click="handleSearchClick">
        <SearchIcon class="menu-icon" />
        <span>搜索</span>
      </button>

      <div class="side-container">
        <nav class="menu-list" aria-label="主菜单">
          <button
            class="menu-item"
            :class="{ active: isActive('/home') }"
            type="button"
            @click="goTo('/home')"
          >
            <ChatIcon class="menu-icon" />
            <span>半窗烟雨</span>
          </button>

          <div class="menu-section">
            <div class="section-title">
              <span>分组</span>
              <t-button
                theme="primary"
                variant="text"
                shape="square"
                size="small"
                @click="openGroupPut()"
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
                  isActive(`/group/${group.id}`) ||
                  isActive(`/new/${group.id}`) ||
                  isStartActive(`/chat/${group.id}/`)
              }"
              type="button"
              @contextmenu="openGroupContextmenu($event, group.id)"
              @click="goTo(`/group/${group.id}`)"
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
            @contextmenu="openGroupContextmenu($event, chat.id)"
            @click="goTo(`/chat/0/${chat.id}`)"
          >
            <FolderIcon class="menu-icon" />
            <span>{{ chat.name }}</span>
          </button>
        </nav>

        <div class="bottom-menu">
          <div class="section-title">
            <span>达利园</span>
            <t-button theme="primary" variant="text" shape="square" size="small">
              <template #icon>
                <add-icon />
              </template>
            </t-button>
          </div>
          <button
            v-for="item in yuanbaoPieMenus"
            :key="`${item.type}-${item.id}`"
            class="menu-item"
            :class="{ active: isActive(item.path) }"
            type="button"
            @click="goTo(item.path)"
          >
            <UsergroupIcon v-if="item.type === 'pie'" class="menu-icon" />
            <UserIcon v-else class="menu-icon" />
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
    <t-content class="main-container">
      <router-view />
    </t-content>
    <div class="common-operator">
      <t-button theme="primary" shape="square" variant="text" @click="toggleCollapsed()">
        <template #icon>
          <view-list-icon />
        </template>
      </t-button>
    </div>
  </t-layout>
</template>
<script lang="ts" setup>
import {
  AddIcon,
  AiArticleIcon,
  AiIcon,
  ChatIcon,
  FolderIcon,
  InternetIcon,
  SearchIcon,
  UsergroupIcon,
  UserIcon,
  ViewListIcon
} from 'tdesign-icons-vue-next'
import { getUserProfile } from '@/utils/native'
import { collapsed, isDark, toggleCollapsed } from '@/global/BeanFactory'
import { useAiChatStore, useAiGroupStore } from '@/store'
import { openGroupContextmenu, openGroupPut } from '@/pages/app/group-func'

interface GroupMenuItem {
  id: string
  name: string
}

interface YuanbaoPieMenuItem {
  id: string
  name: string
  type: 'pie' | 'agent'
  path: string
}

const router = useRouter()
const route = useRoute()

const profile = getUserProfile()

// 分组
const groups = computed(() => useAiGroupStore().state)
const chats = computed(() => useAiChatStore().state)

const pieMenus: Omit<YuanbaoPieMenuItem, 'path'>[] = [
  { id: 'default', name: '蛋黄派', type: 'pie' }
]

const agentMenus: Omit<YuanbaoPieMenuItem, 'path'>[] = [
  { id: 'default', name: '巧克力派', type: 'agent' }
]

const yuanbaoPieMenus = computed<YuanbaoPieMenuItem[]>(() => [
  ...pieMenus.map((item) => ({ ...item, path: `/pie/${item.id}` })),
  ...agentMenus.map((item) => ({ ...item, path: `/agent/${item.id}` }))
])

const isActive = (path: string) => route.path === path
const isStartActive = (path: string) => route.path.startsWith(path)

const goTo = (path: string) => {
  if (route.path !== path) {
    router.push(path)
  }
}

const handleSearchClick = () => {}

const handleSettingClick = (key: string) => router.push(`/setting/${key}`)

onMounted(() => {
  console.log('plugin enter', isDark.value)
})

utools.onPluginEnter((action) => {
  // 对关键字进行处理
  console.log(action)
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
  margin-top: 40px;
  width: 204px;
  overflow-x: hidden;
}

.menu-list {
  display: flex;
  flex-direction: column;
  gap: var(--td-comp-margin-xs);
  min-height: 0;
  overflow-y: auto;
  width: 220px;
  overflow-x: hidden;
}

.menu-section,
.bottom-menu {
  display: flex;
  flex-direction: column;
  gap: var(--td-comp-margin-xs);
  padding-bottom: 8px;
}

.menu-section {
  margin-top: var(--td-comp-margin-xs);
  padding-top: var(--td-comp-paddingTB-xs);
  border-top: 1px solid var(--fluent-sidebar-border);
}

.bottom-menu {
  padding-top: var(--td-comp-paddingTB-s);
  border-top: 1px solid var(--fluent-sidebar-border);
  width: 220px;
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
  padding-right: 16px;
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

.common-operator {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 51;
  display: flex;
  gap: 8px;
}
</style>
