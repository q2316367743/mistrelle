<template>
  <t-layout class="l-chat-tool">
    <t-content class="l-chat-tool__content">
      <r-chat-list
        :messages="displayMessages"
        :clear-history="messages.length > 1 && status !== 'streaming'"
        :status="status"
        style="flex: 1; margin-top: 8px"
        @clear="handleClear"
        @delete="handleDeleteMessage"
        @continue="handleContinue"
        @change="handleMessagesChange"
        @view-sub-agent="handleViewSubAgent"
      />
      <sub-agent-tabs-comp
        v-if="subAgentTabs.length > 1 || activeAgentId !== 'main'"
        :tabs="subAgentTabs"
        :active-id="activeAgentId"
        @switch="handleSwitchAgent"
      />
      <l-chat-sender
        ref="_senderRef"
        :initial="initialState"
        :loading="status === 'pending' || status === 'streaming'"
        :sandbox-dir="sandboxDir"
        :token-usage="tokenUsage"
        lock-workspace
        lock-privacy
        @send="handleSend"
        @stop="handleStop()"
      />
    </t-content>
    <!--    <t-aside v-if="aside" width="240px" class="l-chat-tool__aside shrink-0">-->
    <t-aside
      :width="fullscreen ? '100%' : aside ? `${width}px` : '0'"
      :class="[
        'l-chat-tool__aside',
        'shrink-0',
        { 'border-left-none': !aside },
        { 'l-chat-tool__aside--fullscreen': fullscreen }
      ]"
    >
      <div v-if="aside && !fullscreen" class="l-chat-tool__resizer" @mousedown="startResize" />
      <l-chat-aside
        :messages="messages"
        :workspace="workspace"
        :sandbox="sandboxDir"
        :status="status"
        :todos="instance.todos.value"
        :agent-history="agentHistory"
        :active-agent-id="activeAgentId"
        :type="asideType"
        :writing-scene="writingScene"
        :fullscreen="fullscreen"
        @view-agent="handleViewSubAgent"
      />
    </t-aside>
    <div class="l-chat-tool__header" :class="{ collapsed: collapsed }">
      <div class="l-chat-tool__title">
        <t-tag
          v-if="privacy"
          theme="danger"
          variant="light"
          size="small"
          class="l-chat-tool__private"
        >
          私
        </t-tag>
        <span class="ellipsis" :title="chatName">{{ chatName }}</span>
      </div>
      <div class="ml-auto flex gap-8px chat-operator">
        <todo-progress-button :todos="instance.todos.value" />
        <t-button theme="default" variant="text" shape="square" @click="toggleFullscreen()">
          <template #icon>
            <fullscreen-exit1-icon v-if="fullscreen" />
            <fullscreen1-icon v-else />
          </template>
        </t-button>
        <t-button theme="default" variant="text" shape="square" @click="toggleAside()">
          <template #icon>
            <AsideRightIcon />
          </template>
        </t-button>
      </div>
    </div>
  </t-layout>
</template>
<script lang="ts" setup>
import SubAgentTabsComp from '@/components/chat/SubAgentTabs.vue'
import TodoProgressButton from '@/components/chat/TodoProgressButton.vue'
import RChatList from './RChatList.vue'
import LChatSender from './sender/LChatSender.vue'
import LChatAside from './aside/LChatAside.vue'
import { useChatSession } from './useChatSession'
import { collapsed, toggleCollapsed } from '@/global/BeanFactory'
import { useBoolState, useTitlePadding, useUtoolsKvStorage } from '@/hooks'
import { LocalNameEnum } from '@/global/LocalNameEnum'
import AsideRightIcon from '@/assets/icons/AsideRightIcon.vue'
import { Fullscreen1Icon, FullscreenExit1Icon } from 'tdesign-icons-vue-next'

const props = withDefaults(
  defineProps<{
    chatId: string
    chatName: string
    storageKey: string
    /** 隐私聊天标记：标题前展示「私」标识 */
    privacy?: boolean
    /** 外部指定沙盒目录，缺省时按 chatId 自动推导 */
    sandboxDir?: string
    height?: string
  }>(),
  {
    privacy: false,
    height: '100vh'
  }
)

// 侧边栏是否展示
const [aside, toggleAside] = useBoolState(false)
const [fullscreen, toggleFullscreen] = useBoolState(false)
// 侧边栏宽度
const width = useUtoolsKvStorage<number>(LocalNameEnum.KEY_AI_ASIDE_WIDTH, 232)

// 侧边栏宽度边界：硬性上下限；内容区至少保底 CONTENT_MIN_WIDTH，窗口缩小时按此收敛
const MIN_WIDTH = 180
const MAX_WIDTH = 640
const CONTENT_MIN_WIDTH = 320
/** 当前窗口允许的侧边栏最大宽度 */
const maxWidthByWindow = () => Math.min(MAX_WIDTH, window.innerWidth - CONTENT_MIN_WIDTH)
/** 把宽度收敛到 [MIN_WIDTH, 窗口上限] 区间 */
const clampWidth = (value: number) => Math.min(maxWidthByWindow(), Math.max(MIN_WIDTH, value))

/**
 * 拖动侧边栏左边缘调整宽度：记录拖动起点后挂全局监听，实时收敛宽度；松开时清理监听并还原光标。
 * 侧边栏位于右侧，鼠标向左移动（clientX 减小）即宽度增加。
 */
const startResize = (e: MouseEvent) => {
  const startX = e.clientX
  const startWidth = width.value
  const onMove = (ev: MouseEvent) => {
    width.value = clampWidth(startWidth + (startX - ev.clientX))
  }
  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

/** 窗口尺寸变化时按当前可用空间重新收敛宽度，避免侧边栏超出窗口 */
const handleWindowResize = () => {
  width.value = clampWidth(width.value)
}

const {
  senderRef: _senderRef,
  instance,
  messages,
  status,
  workspace,
  writingScene,
  sandboxDir,
  initialState,
  tokenUsage,
  handleSend,
  handleStop,
  handleClear,
  handleDeleteMessage,
  handleContinue,
  handleMessagesChange,
  activeAgentId,
  subAgentTabs,
  agentHistory,
  displayMessages,
  asideType,
  handleSwitchAgent,
  handleViewSubAgent
} = useChatSession({
  chatId: props.chatId,
  storageKey: props.storageKey,
  sandboxDir: props.sandboxDir
})

onMounted(() => {
  window.addEventListener('resize', handleWindowResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize)
})

// 画布面板（design / ppt 会话或对应子 Agent）默认展开侧边栏：type 需异步水合，故用 watch 而非直接判断
watch(
  asideType,
  (type) => {
    if (['design', 'ppt', 'writing'].includes(type)) {
      aside.value = true
      toggleCollapsed(true)
    }
  },
  { immediate: true }
)

const { l2, r1 } = useTitlePadding()
const paddingLeft = computed(() => `${l2}px`)
const paddingRight = computed(() => `${8 + r1}px`)
</script>
<style scoped lang="less">
.l-chat-tool {
  position: relative;
  overflow: hidden;
  height: v-bind(height);
  padding: 48px 8px 8px;
  z-index: 52;

  &__content {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 0;

    flex: 1;
    min-width: 0;
    width: 100%;
  }
  &__header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 11;
    height: 48px;
    box-sizing: border-box;
    color: var(--td-text-color-primary);
    padding: 8px v-bind(paddingRight);
    transition: padding-left 0.1s ease-in-out;
    border-bottom: 1px solid var(--td-border-level-1-color);

    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;

    &.collapsed {
      padding-left: v-bind(paddingLeft);
    }
  }
  &__title {
    display: flex;
    align-items: center;
    font-size: 20px;
    font-weight: 600;
    width: calc(100% - 240px);
  }

  &__private {
    flex-shrink: 0;
    margin-right: 8px;
    font-weight: 500;
  }

  &__aside {
    position: relative;
    border-left: 1px solid var(--td-border-level-1-color);
    &.border-left-none {
      border-left: none;
    }
    &.l-chat-tool__aside--fullscreen {
      position: absolute;
      top: 48px;
      right: 0;
      bottom: 0;
      left: 0;
      z-index: 10;
      border-left: none;
      background-color: var(--td-bg-color-container) !important;
    }
  }
  &__resizer {
    position: absolute;
    top: 0;
    bottom: 0;
    left: -3px;
    width: 6px;
    cursor: col-resize;
    z-index: 10;
  }
}

.chat-operator {
  z-index: 53;
  -webkit-app-region: no-drag;
}
</style>
