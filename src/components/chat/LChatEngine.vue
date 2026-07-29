<template>
  <div class="l-chat-tool">
    <div class="l-chat-tool__content">
      <r-chat-list
        :messages="messages"
        :clear-history="messages.length > 1 && status !== 'streaming'"
        :status="status"
        style="flex: 1"
        @clear="handleClear"
        @delete="handleDeleteMessage"
        @change="handleMessagesChange"
      />
      <l-chat-sender
        :initial-input="inputValue"
        :initial-model="modelValue"
        :initial-agent-id="initialAgentId"
        :initial-workspace="workspace"
        :loading="status === 'pending' || status === 'streaming'"
        :sandbox-dir="sandboxDir"
        @send="handleSend"
        @stop="handleStop()"
      />
    </div>
  </div>
</template>
<script lang="ts" setup>
import type { ChatRequestParams } from '@/modules/chat'
import { ToolChat, aiChatContentGet, aiChatContentSet, getSandboxDir } from '@/modules/chat'
import type { UserMessage } from '@/domain'
import type { AiChatContent } from '@/entity/ai'
import { toolConfirmDialog } from '@/components/chat/modals/ToolConfirmDialog'
import { toolMap } from '@/modules/tool'

const props = withDefaults(
  defineProps<{
    chatId: string
    storageKey: string
    /** 外部指定沙盒目录，缺省时按 chatId 自动推导 */
    sandboxDir?: string
    height?: string
  }>(),
  {
    height: 'calc(100vh - 66px)'
  }
)

const inputValue = ref('')
const modelValue = ref('')
const initialAgentId = ref('')
const workspace = ref('')

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
  toolConfirmHandler: confirmTool
})

watch(sandboxDir, (val) => instance.setSandboxDir(val), { immediate: true })

const { messages, status } = instance

const handleSend = async (message: ChatRequestParams) => {
  if (message.workspace) workspace.value = message.workspace
  instance.sendUserMessage(message)
}

const handleStop = () => {
  instance.abortChat()
}

const handleClear = () => {
  messages.value = []
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
      if (content.workspace) {
        workspace.value = content.workspace
        instance.setWorkspace(content.workspace)
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
          messages: toRaw(val)
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
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 0;
  overflow: hidden;
  padding: 8px;
  height: v-bind(height);
}

.l-chat-tool__content {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  width: 100%;
}
</style>
