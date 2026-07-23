<template>
  <div class="l-chat-tool">
    <div class="l-chat-tool__content">
      <r-chat-list
        :messages="messages"
        :clear-history="messages.length > 1 && status !== 'streaming'"
        :text-loading="status === 'pending'"
        :is-stream-load="status === 'streaming'"
        style="flex: 1"
        @clear="handleClear"
        @reask="handleReask"
        @rollback="handleRollback"
        @change="handleMessagesChange"
      />
      <l-chat-sender
        :initial-input="inputValue"
        :initial-model="modelValue"
        :initial-agent-id="initialAgentId"
        :loading="status === 'pending' || status === 'streaming'"
        :root-dir="rootDir"
        @send="handleSend"
        @stop="handleStop()"
      />
    </div>
  </div>
</template>
<script lang="ts" setup>
import { ChatRequestParams, ToolChat, aiChatContentGet, aiChatContentSet } from '@/modules/chat'
import type { UserMessage } from '@/domain'
import type { AiChatContent } from '@/entity/ai'
import { toolConfirmDialog } from '@/components/chat/modals/ToolConfirmDialog'
import { toolMap } from '@/modules/tool'

const props = withDefaults(
  defineProps<{
    storageKey?: string
    rootDir?: string
  }>(),
  {}
)

const inputValue = ref('')
const modelValue = ref('')
const initialAgentId = ref('')

const confirmTool = (toolName: string, args: Record<string, unknown>): Promise<boolean> => {
  const tool = toolMap[toolName]
  const label = tool?.label || toolName
  return toolConfirmDialog(label, toolName, JSON.stringify(args, null, 2))
}

const instance = new ToolChat({
  toolConfirmHandler: confirmTool
})

const { messages, status } = instance

const createRequestParams = (message: UserMessage): ChatRequestParams => ({
  content: message.content,
  model: message.model,
  provide: message.provide,
  agentId: message.agentId,
  reasoning_effort: message.reasoning_effort
})

const handleSend = async (message: ChatRequestParams) => {
  instance.sendUserMessage(message)
}

const handleStop = () => {
  instance.abortChat()
}

const handleClear = () => {
  messages.value = []
}

const handleReask = (messageId: string) => {
  const userMessage = messages.value.find(
    (m): m is UserMessage => m.id === messageId && m.role === 'user'
  )
  if (!userMessage) return
  const requestParams = createRequestParams(userMessage)
  instance.reaskMessage(messageId, requestParams)
}

const handleRollback = (messageId: string) => {
  instance.rollbackBeforeMessage(messageId)
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
    }
  }

  if (props.storageKey) {
    unWatch = throttledWatch(
      messages,
      async (val) => {
        await aiChatContentSet(props.storageKey!, {
          updatedTime: Date.now(),
          draft: undefined,
          messages: toRaw(val)
        })
      },
      { throttle: 1000, deep: true }
    )
  }

  const hasUserMessage = messages.value.some((m) => m.role === 'user')

  if (!hasUserMessage && content?.draft) {
    const { draft } = content
    initialAgentId.value = draft.agentId || ''
    instance.sendUserMessage(draft)
  } else if (messages.value.length > 1) {
    const lastUser = messages.value.findLast((e) => e.role === 'user') as UserMessage | undefined
    if (lastUser) {
      modelValue.value = `${lastUser.provide}:${lastUser.model}`
      initialAgentId.value = lastUser.agentId || ''
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
  width: calc(100% - 16px);
  min-height: 0;
  overflow: hidden;
  padding: 8px;
  height: calc(100vh - 66px);
}

.l-chat-tool__content {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  width: 100%;
  max-width: 1080px;
}
</style>
