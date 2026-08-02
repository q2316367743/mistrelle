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
      <sub-agent-tabs
        v-if="subAgentTabs.length > 1"
        :tabs="subAgentTabs"
        :active-id="activeAgentId"
        @switch="handleSwitchAgent"
      />
      <l-chat-sender
        :initial-input="inputValue"
        :initial-model="modelValue"
        :initial-agent-id="agentId"
        :initial-workspace="workspace"
        :initial-mode="mode"
        :loading="status === 'pending' || status === 'streaming'"
        :sandbox-dir="sandboxDir"
        @send="handleSend"
        @stop="handleStop()"
      />
    </t-content>
    <!--    <t-aside v-if="aside" width="240px" class="l-chat-tool__aside shrink-0">-->
    <t-aside
      :width="aside ? '240px' : '0'"
      :class="['l-chat-tool__aside', 'shrink-0', { 'border-left-none': !aside }]"
    >
      <l-chat-aside
        :messages="messages"
        :workspace="workspace"
        :sandbox="sandboxDir"
        :todos="instance.todos.value"
      />
    </t-aside>
    <div class="l-chat-tool__header" :class="{ collapsed: collapsed }">
      <div class="l-chat-tool__title">
        <span class="ellipsis" :title="chatName">{{ chatName }}</span>
      </div>
      <t-button theme="default" variant="text" shape="square" @click="toggleAside()">
        <template #icon>
          <app-icon />
        </template>
      </t-button>
    </div>
  </t-layout>
</template>
<script lang="ts" setup>
import type { ChatRequestParams } from '@/modules/chat'
import { getChatSession, getSandboxDir } from '@/modules/chat'
import type { ChatMessage, UserMessage } from '@/domain'
import { INTERACTIVE_KEY } from '@/modules/chat/agent/interactive'
import { readSubAgentContent, getRunningSubAgentMessages } from '@/modules/chat/agent/SubAgentRunner'
import SubAgentTabs, { type AgentTabItem } from '@/components/chat/SubAgentTabs.vue'
import { collapsed } from '@/global/BeanFactory'
import { AppIcon } from 'tdesign-icons-vue-next'
import { useBoolState } from '@/hooks'

const props = withDefaults(
  defineProps<{
    chatId: string
    chatName: string
    storageKey: string
    /** 外部指定沙盒目录，缺省时按 chatId 自动推导 */
    sandboxDir?: string
    height?: string
  }>(),
  {
    height: '100vh'
  }
)

const inputValue = ref('')
const modelValue = ref('')
const [aside, toggleAside] = useBoolState(false)

const sandboxDir = computed(() => {
  return props.sandboxDir || getSandboxDir(props.chatId)
})

// 会话由会话管理器持有，跨组件挂载存活：组件只负责绑定数据与转发事件
const session = getChatSession(props.storageKey, { sandboxDir: sandboxDir.value, chatId: props.chatId })
const instance = session.chat

// 交互桥供 ask/confirm 卡片注入作答；本组件是 UI 消费方，使能后挂起决策才能被作答
provide(INTERACTIVE_KEY, instance.interactive)
instance.interactive.setEnabled(true)

watch(sandboxDir, (val) => instance.setSandboxDir(val), { immediate: true })

const { messages, status } = instance
const workspace = session.workspace
const mode = session.mode
const agentId = session.agentId

const handleSend = (message: ChatRequestParams) => {
  void session.send(message)
}

const handleStop = () => {
  session.stop()
}

const handleClear = () => {
  session.clear()
}

const handleDeleteMessage = (messageId: string) => {
  session.removeMessage(messageId)
}

const handleContinue = (assistantMessageId: string) => {
  session.continue(assistantMessageId)
}

const handleMessagesChange = () => {
  session.refreshMessages()
}

onMounted(() => {
  void session.load()
})

// 恢复上次使用的模型：新会话草稿发送时 user 消息一加入即可回填，无需等待整个回答结束
watch(
  messages,
  (val) => {
    const lastUser = val.findLast((e) => e.role === 'user') as UserMessage | undefined
    if (lastUser) {
      modelValue.value = `${lastUser.provide}:${lastUser.model}`
    }
  },
  { immediate: true }
)

// ─── 子 Agent 切换 ────────────────────────────────────────────────

/** 当前选中的 Agent：'main' 表示主 Agent，否则为子 Agent ID */
const activeAgentId = ref<string>('main')
/** 子 Agent 消息快照（切换 tab 时从 sub_{subId}.json 加载） */
const subAgentMessages = ref<ChatMessage[] | null>(null)

/**
 * 从主 Agent 消息中收集全部 spawn_agent 工具调用，构建 Agent 切换卡片数据。
 * 工具调用的 ext.subAgentId 与 AIMessage.subAgentIds 对应。
 */
const subAgentTabs = computed<AgentTabItem[]>(() => {
  const tabs: AgentTabItem[] = [{ id: 'main', label: '主 Agent' }]
  const subAgentMap = new Map<string, { task: string; status: 'running' | 'completed' | 'error' }>()

  for (const msg of messages.value) {
    if (msg.role !== 'assistant' || !msg.content) continue
    for (const content of msg.content) {
      if (content.type !== 'toolcall' || content.data.toolCallName !== 'spawn_agent') continue
      const subId = content.ext?.subAgentId
      if (!subId || typeof subId !== 'string') continue
      let task = ''
      try {
        const parsed = JSON.parse(content.data.args ?? '{}') as { task?: string }
        task = parsed.task ?? ''
      } catch {
        // args 解析失败则忽略任务摘要
      }
      const s = content.status
      const status = s === 'error' ? 'error' : s === 'pending' || s === 'streaming' ? 'running' : 'completed'
      subAgentMap.set(subId, { task, status })
    }
  }

  let index = 1
  subAgentMap.forEach((info, subId) => {
    tabs.push({ id: subId, label: `子 Agent ${index++}`, task: info.task, status: info.status })
  })
  return tabs
})

/** 当前展示的消息列表：主 Agent 显示会话消息；子 Agent 运行中实时绑定消息流，已完成显示磁盘快照 */
const displayMessages = computed(() => {
  if (activeAgentId.value === 'main') return messages.value
  // 运行中的子 Agent：直接绑定其响应式 messages（streaming 实时刷新）
  const live = getRunningSubAgentMessages(activeAgentId.value)
  if (live) return live.value
  // 已完成：磁盘快照
  return subAgentMessages.value ?? []
})

// 切换 Agent tab：主 Agent 直接切回会话消息；子 Agent 运行中跳过磁盘加载（实时绑定），否则从磁盘加载快照
watch(activeAgentId, async (agentId) => {
  if (agentId === 'main') {
    subAgentMessages.value = null
    return
  }
  // 运行中的子 Agent：displayMessages 实时绑定，无需磁盘快照
  if (getRunningSubAgentMessages(agentId)) {
    subAgentMessages.value = null
    return
  }
  try {
    const loaded = await readSubAgentContent(props.chatId, agentId)
    subAgentMessages.value = loaded ?? []
  } catch {
    subAgentMessages.value = []
  }
})

/** 当前选中的子 Agent 是否在运行中（依赖注册表，注册/注销时重算） */
const activeSubRunning = computed(() => {
  if (activeAgentId.value === 'main') return false
  return !!getRunningSubAgentMessages(activeAgentId.value)
})

// 子 Agent 从运行中变为完成（从注册表移除）的瞬间：重载磁盘快照，避免 displayMessages 突变为空
watch(activeSubRunning, async (running) => {
  if (running || activeAgentId.value === 'main') return
  try {
    const loaded = await readSubAgentContent(props.chatId, activeAgentId.value)
    subAgentMessages.value = loaded ?? []
  } catch {
    subAgentMessages.value = []
  }
})

const handleSwitchAgent = (agentId: string) => {
  activeAgentId.value = agentId
}

/** 点击 spawn_agent 工具卡片：切换到对应子 Agent */
const handleViewSubAgent = (subAgentId: string) => {
  activeAgentId.value = subAgentId
}
</script>
<style scoped lang="less">
.l-chat-tool {
  overflow: hidden;
  height: v-bind(height);
  padding: 48px 8px 16px;

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
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    color: var(--td-text-color-primary);
    padding: 8px;
    transition: padding-left 0.1s ease-in-out;
    border-bottom: 1px solid var(--td-border-level-1-color);

    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;

    &.collapsed {
      padding-left: 48px;
    }
  }
  &__title {
    display: flex;
    align-items: center;
    font-size: 20px;
    font-weight: 600;
    width: calc(100% - 120px);
  }

  &__aside {
    border-left: 1px solid var(--td-border-level-1-color);
    &.border-left-none {
      border-left: none;
    }
  }
}
</style>
