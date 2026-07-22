<template>
  <div class="l-chat-tool">
    <div class="l-chat-tool__content">
      <r-chat-list
        :messages="messages"
        :clear-history="messages.length > 1 && status !== 'streaming'"
        style="flex: 1"
        @clear="handleClear"
        @reask="handleReask"
        @rollback="handleRollback"
        @change="handleMessagesChange"
      />
      <l-chat-sender
        :initial-input="inputValue"
        :initial-model="modelValue"
        :initial-think="think"
        :loading="status === 'pending' || status === 'streaming'"
        :placeholder="placeholder"
        :root-dir="rootDir"
        @send="handleSend"
        @stop="handleStop()"
      />
    </div>
  </div>
</template>
<script lang="ts" setup>
import {
  ChatRequestParams,
  ToolChat,
  aiChatContentGet,
  aiChatContentSet
} from '@/modules/chat'
import { useSettingAiStore } from '@/store'
import { MessageUtil } from '@/utils/modal'
import type { AttachmentContent, ToolFunction, UserMessage, UserMessageContent } from '@/domain'
import type { AiChatContent, AiChatDraft } from '@/entity/ai'
import { toolConfirmDialog } from '@/components/chat/modals/ToolConfirmDialog'
import { toolMap } from '@/modules/tool'

const props = withDefaults(
  defineProps<{
    functions: ToolFunction[]
    prompt: string
    storageKey?: string
    placeholder?: string
    rootDir?: string
  }>(),
  {}
)

const inputValue = ref('')
const think = ref(false)
const modelValue = ref('')

const confirmTool = (toolName: string, args: Record<string, unknown>): Promise<boolean> => {
  const tool = toolMap[toolName]
  const label = tool?.label || toolName
  return toolConfirmDialog(label, toolName, JSON.stringify(args, null, 2))
}

const instance = new ToolChat({
  functions: props.functions,
  toolConfirmHandler: confirmTool
})

const { messages, status } = instance

const createRequestParams = (message: UserMessage): ChatRequestParams | null => {
  const option = useSettingAiStore().optionMap.get(`${message.provide}:${message.model}`)
  if (!option) {
    MessageUtil.error('请选择模型')
    return null
  }
  return {
    content: message.content,
    model: message.model,
    provide: message.provide,
    baseURL: option.baseUrl,
    apiKey: option.key,
    thinking: message.thinking
  }
}

const buildReferenceContext = async (contents: UserMessageContent[]): Promise<string | null> => {
  const attachments = contents
    .filter((c): c is AttachmentContent => c.type === 'attachment')
    .flatMap((c) => c.data)
  if (attachments.length === 0) return ''
  const parts: string[] = []
  for (const item of attachments) {
    try {
      parts.push(
        `## File: ${item.name ?? item.url}\n路径：${item.url}\n\n${await window.preload.fs.readTextFile(item.url ?? '')}`
      )
    } catch (err) {
      MessageUtil.error(`读取文件失败：${err instanceof Error ? err.message : String(err)}`)
      return null
    }
  }
  return `\n\n---\n以下是用户在输入框中引用的上下文，请结合这些内容回答：\n\n${parts.join('\n\n---\n\n')}`
}

const handleSend = async (message: UserMessage) => {
  const requestParams = createRequestParams(message)
  if (!requestParams) return
  const context = await buildReferenceContext(message.content)
  if (context === null) return
  if (context) requestParams.referenceContext = context

  instance.sendUserMessage(requestParams)
}

const handleStop = () => {
  instance.abortChat()
}

const handleClear = () => {
  if (!props.prompt) {
    messages.value = []
    return
  }
  messages.value = [
    {
      id: '0',
      role: 'system',
      content: [
        {
          type: 'text',
          data: props.prompt,
          status: 'complete',
          time: Date.now()
        }
      ]
    }
  ]
}

const handleReask = (messageId: string) => {
  const userMessage = messages.value.find(
    (m): m is UserMessage => m.id === messageId && m.role === 'user'
  )
  if (!userMessage) return
  const requestParams = createRequestParams(userMessage)
  if (!requestParams) return
  instance.reaskMessage(messageId, requestParams)
}

const handleRollback = (messageId: string) => {
  instance.rollbackBeforeMessage(messageId)
}

const handleMessagesChange = () => {
  messages.value = [...messages.value]
}

const fillSenderFromDraft = (draft: AiChatDraft) => {
  inputValue.value = draft.content
    .filter((c) => c.type === 'text')
    .map((c) => c.data)
    .join('')
  modelValue.value = `${draft.provide}:${draft.model}`
  think.value = draft.thinking === 'enabled'
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

  if (messages.value.length === 0 && props.prompt) {
    await instance.sendSystemMessage(props.prompt)
  }

  const hasUserMessage = messages.value.some((m) => m.role === 'user')

  if (!hasUserMessage && content?.draft) {
    const draft = content.draft
    const option = useSettingAiStore().optionMap.get(`${draft.provide}:${draft.model}`)
    if (!option) {
      fillSenderFromDraft(draft)
      MessageUtil.error('草稿中的模型不可用，请重新选择模型后发送')
      return
    }
    const requestParams: ChatRequestParams = {
      content: draft.content,
      model: draft.model,
      provide: draft.provide,
      baseURL: option.baseUrl,
      apiKey: option.key,
      thinking: draft.thinking
    }
    const referenceContext = await buildReferenceContext(draft.content)
    if (referenceContext === null) {
      fillSenderFromDraft(draft)
      return
    }
    if (referenceContext) requestParams.referenceContext = referenceContext
    instance.sendUserMessage(requestParams)
  } else if (messages.value.length > 1) {
    const lastUser = messages.value.findLast((e) => e.role === 'user')
    if (lastUser) {
      modelValue.value = `${lastUser.provide}:${lastUser.model}`
      think.value = lastUser.thinking === 'enabled'
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
