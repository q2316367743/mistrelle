<template>
  <div class="l-chat-tool">
    <div class="l-chat-tool__content" :style="contentStyle">
      <!-- 消息列表 -->
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
import type { CSSProperties } from 'vue'
import {
  type ToolFunction,
  ChatRequestParams,
  ToolChat,
  aiChatContentGet,
  aiChatContentSet
} from '@/modules/chat'
import { useSettingAiStore } from '@/store'
import { MessageUtil } from '@/utils/modal'
import type { AttachmentContent, UserMessage, UserMessageContent } from '@/domain'
import type { AiChatContent, AiChatDraft } from '@/entity/ai'

type ChatToolLayout = 'compact' | 'wide'

const props = withDefaults(
  defineProps<{
    functions: ToolFunction[]
    prompt: string
    storageKey?: string
    placeholder?: string
    layout?: ChatToolLayout
    compactWidth?: string
    wideMaxWidth?: string
    rootDir?: string
  }>(),
  {
    layout: 'wide',
    compactWidth: '720px',
    wideMaxWidth: '1080px'
  }
)

const inputValue = ref('')
const think = ref(false)
const modelValue = ref('')

const instance = new ToolChat({ functions: props.functions })

const { messages, status } = instance

const contentStyle = computed<CSSProperties>(() => {
  if (props.layout === 'compact') {
    return {
      width: props.compactWidth,
      maxWidth: '100%'
    }
  }

  return {
    width: '100%',
    maxWidth: props.wideMaxWidth
  }
})

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

// 文件内容注入：从结构化 content 的 AttachmentContent 读取本地文件全文，
// 拼为 referenceContext（仅文件内容；skill 全文改由 applySkillToChat 按 SkillContent 注入系统提示词）。
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

// 接收 sender 随 send 事件带出的完整 UserMessage，直接构造请求
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

// 发送失败时把草稿回填到 sender，让用户可重试
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

  // 保存起来（写入完整 AiChatContent，同时清空 draft）
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

  // 如果第一次且有提示词，则注入系统提示词
  if (messages.value.length === 0 && props.prompt) {
    await instance.sendSystemMessage(props.prompt)
  }

  const hasUserMessage = messages.value.some((m) => m.role === 'user')

  // 没有用户消息且存在草稿：自动发送
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
    // 有历史消息时，从最后一条用户消息还原 sender 初始态
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
}
</style>
