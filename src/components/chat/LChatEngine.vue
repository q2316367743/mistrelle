<template>
  <t-layout class="l-chat-tool">
    <t-content class="l-chat-tool__content">
      <r-chat-list
        :messages="messages"
        :clear-history="messages.length > 1 && status !== 'streaming'"
        :status="status"
        style="flex: 1; margin-top: 8px"
        @clear="handleClear"
        @delete="handleDeleteMessage"
        @change="handleMessagesChange"
      />
      <l-chat-sender
        :initial-input="inputValue"
        :initial-model="modelValue"
        :initial-agent-id="initialAgentId"
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
import { ToolChat, aiChatContentGet, aiChatContentSet, getSandboxDir } from '@/modules/chat'
import type { UserMessage } from '@/domain'
import { AiChatContent, AiChatItem, AiChatMode } from '@/entity/ai'
import { toolConfirmDialog } from '@/components/chat/modals/ToolConfirmDialog'
import { toolMap } from '@/modules/tool'
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
const initialAgentId = ref('')
const workspace = ref('')
const mode = ref<AiChatMode>(0)
const [aside, toggleAside] = useBoolState(false)

const sandboxDir = computed(() => {
  return props.sandboxDir || getSandboxDir(props.chatId)
})

/** 策略层已裁决为 ask，此处仅负责弹窗询问用户 */
const confirmTool = (toolName: string, args: Record<string, unknown>): Promise<boolean> => {
  const tool = toolMap[toolName]
  const label = tool?.label || toolName
  return toolConfirmDialog(label, toolName, JSON.stringify(args, null, 2))
}

const instance = new ToolChat({
  toolConfirmHandler: confirmTool,
  mode: mode.value
})

watch(sandboxDir, (val) => instance.setSandboxDir(val), { immediate: true })

const { messages, status } = instance

const handleSend = (message: ChatRequestParams) => {
  if (message.workspace) workspace.value = message.workspace
  instance.sendUserMessage(message)
}

const handleStop = () => {
  instance.abortChat()
}

const handleClear = () => {
  messages.value = []
  instance.todos.value = []
}

const handleDeleteMessage = (messageId: string) => {
  instance.deleteFromUserMessage(messageId)
}

const handleMessagesChange = () => {
  messages.value = [...messages.value]
}

let unWatch: (() => void) | null = null

onMounted(async () => {
  let content: AiChatContent | undefined
  if (props.storageKey) {
    content = await aiChatContentGet(props.storageKey)
    if (content) {
      instance.init(content.messages)
      if (content.todos) instance.setTodos(content.todos)
      if (content.workspace) {
        workspace.value = content.workspace
        instance.setWorkspace(content.workspace)
        mode.value = content.mode
        instance.setMode(content.mode)
      }
      if (content.agentId) initialAgentId.value = content.agentId
    }
  }

  if (props.storageKey) {
    unWatch = throttledWatch(
      messages,
      async (val) => {
        await aiChatContentSet(props.storageKey!, {
          updatedTime: Date.now(),
          draft: undefined,
          agentId: initialAgentId.value,
          workspace: workspace.value || '',
          messages: toRaw(val),
          mode: mode.value,
          todos: toRaw(instance.todos.value)
        })
      },
      { throttle: 1000, deep: true }
    )
  }
  initialAgentId.value = content?.agentId || ''

  const hasUserMessage = messages.value.some((m) => m.role === 'user')

  if (!hasUserMessage && content?.draft) {
    const { draft } = content
    instance.sendUserMessage(draft)
    modelValue.value = `${draft?.message.provide}:${draft?.message.model}`
  } else if (messages.value.length > 1) {
    const lastUser = messages.value.findLast((e) => e.role === 'user') as UserMessage | undefined
    if (lastUser) {
      modelValue.value = `${lastUser.provide}:${lastUser.model}`
    }
  }
})

onUnmounted(() => {
  unWatch?.()
  instance.destroy()
})
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
