<template>
  <div class="l-chat-tool" :style="containerStyle">
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
        ref="senderRef"
        v-model:input="inputValue"
        v-model:model="modelValue"
        v-model:think="think"
        :loading="status === 'pending' || status === 'streaming'"
        :placeholder="placeholder"
        :root-dir="rootDir"
        @send="handleSend()"
        @stop="handleStop()"
      />
    </div>
  </div>
</template>
<script lang="ts" setup>
import type { CSSProperties } from 'vue'
import { useUtoolsKvStorage } from '@/hooks'
import {
  type ToolFunction,
  ChatRequestParams,
  ToolChat,
  aiChatMessagesGet,
  aiChatMessagesSet
} from '@/modules/chat'
import { useSettingAiStore } from '@/store'
import { MessageUtil } from '@/utils/modal'
import { LocalNameEnum } from '@/global/LocalNameEnum'
import { localSkillContentGet, type LocalSkill } from '@/modules/skill'
import type { ChatFileRef } from '@/utils/chatSender'

type ChatToolLayout = 'compact' | 'wide'

interface ChatSenderExpose {
  getSelectedSkills: () => LocalSkill[]
  getSelectedFiles: () => ChatFileRef[]
  clearRefs: () => void
}

const props = withDefaults(
  defineProps<{
    functions: ToolFunction[]
    prompt: string
    height?: string
    storageKey?: string
    placeholder?: string
    layout?: ChatToolLayout
    compactWidth?: string
    wideMaxWidth?: string
    rootDir?: string
  }>(),
  {
    height: 'calc(100vh - 66px)',
    layout: 'wide',
    compactWidth: '720px',
    wideMaxWidth: '1080px'
  }
)
const emit = defineEmits(['initial'])

const inputValue = ref('')
const think = ref(false)
const modelValue = useUtoolsKvStorage<string>(LocalNameEnum.KEY_AI_COMMON_MODEL, '')
const senderRef = ref<ChatSenderExpose>()

const instance = new ToolChat({ functions: props.functions })

const { messages, status } = instance

const containerStyle = computed<CSSProperties>(() => ({
  height: props.height
}))

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

const createRequestParams = (content: string): ChatRequestParams | null => {
  const model = useSettingAiStore().optionMap.get(modelValue.value)
  if (!model) {
    MessageUtil.error('请选择模型')
    return null
  }

  return {
    content,
    model: model.identifier,
    provide: model.provideId,
    baseURL: model.baseUrl,
    apiKey: model.key,
    thinking: think.value ? 'enabled' : 'disabled'
  }
}

const buildReferenceContext = async (): Promise<string | null> => {
  const sender = senderRef.value
  if (!sender) return ''
  const parts: string[] = []
  for (const skill of sender.getSelectedSkills()) {
    try {
      parts.push(
        `## Skill: ${skill.name}\n路径：${skill.path}\n\n${await localSkillContentGet(skill)}`
      )
    } catch (err) {
      MessageUtil.error(`读取 Skill 失败：${err instanceof Error ? err.message : String(err)}`)
      return null
    }
  }
  for (const file of sender.getSelectedFiles()) {
    try {
      parts.push(
        `## File: ${file.relativePath}\n路径：${file.path}\n\n${await window.preload.fs.readTextFile(file.path)}`
      )
    } catch (err) {
      MessageUtil.error(`读取文件失败：${err instanceof Error ? err.message : String(err)}`)
      return null
    }
  }
  if (parts.length === 0) return ''
  return `\n\n---\n以下是用户在输入框中引用的上下文，请结合这些内容回答：\n\n${parts.join('\n\n---\n\n')}`
}

const handleSend = async () => {
  const context = await buildReferenceContext()
  if (context === null) return
  const requestParams = createRequestParams(inputValue.value)
  if (!requestParams) return
  if (context) requestParams.referenceContext = context

  instance.sendUserMessage(requestParams)

  inputValue.value = ''
  senderRef.value?.clearRefs()
}

const handleStop = () => {
  instance.abortChat()
}

const handleClear = () => {
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
  const requestParams = createRequestParams('')
  if (!requestParams) return

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
  if (props.storageKey) {
    const c = await aiChatMessagesGet(props.storageKey)
    if (c) {
      instance.init(c)
    }
  }

  // 保存起来
  if (props.storageKey) {
    unWatch = throttledWatch(
      messages,
      async (val) => {
        await aiChatMessagesSet(props.storageKey!, toRaw(val))
      },
      { throttle: 1000, deep: true }
    )
  }

  const messageCount = messages.value.length

  console.debug('messageCount', messageCount)

  // 如果第一次，则需要注入系统提示词
  if (messages.value.length === 0) {
    await instance.sendSystemMessage(props.prompt)
  }
  emit('initial', messageCount < 2)
  if (messages.value.length > 1) {
    // 寻找最后一个用户消息
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

defineExpose({
  sendUserMessage: (msg: ChatRequestParams) => {
    inputValue.value = msg.content
    modelValue.value = msg.model
    handleSend()
  }
})
</script>
<style scoped lang="less">
.l-chat-tool {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  min-height: 0;
  overflow: hidden;
  padding-bottom: 16px;
}

.l-chat-tool__content {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
</style>
