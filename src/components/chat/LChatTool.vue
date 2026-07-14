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

      <!-- 输入框 -->
      <ChatSender
        v-model="inputValue"
        :textarea-props="{ placeholder: placeholder }"
        :loading="status === 'pending' || status === 'streaming'"
        @send="handleSend"
        @stop="handleStop"
      >
        <template #footer-prefix>
          <div class="model-select">
            <div class="flex gap-8px">
              <t-select v-model="modelValue" :options="options" />
              <div class="w-32px">
                <t-button
                  :variant="think ? 'base' : 'outline'"
                  shape="round"
                  :theme="think ? 'primary' : 'default'"
                  @click="toggleThink()"
                >
                  <template #icon>
                    <SystemSumIcon />
                  </template>
                  深度思考
                </t-button>
              </div>
            </div>
          </div>
        </template>
      </ChatSender>
    </div>
  </div>
</template>
<script lang="ts" setup>
import type { CSSProperties } from 'vue'
import { ChatSender } from '@tdesign-vue-next/chat'
import { SystemSumIcon } from 'tdesign-icons-vue-next'
import { cloneDeep } from 'es-toolkit'
import { useBoolState, useUtoolsKvStorage } from '@/hooks'
import { type ToolFunction, ChatRequestParams, ToolChat } from '@/modules/chat'
import { useSettingAiStore } from '@/store'
import { MessageUtil } from '@/utils/modal'
import { LocalNameEnum } from '@/global/LocalNameEnum'
import { ChatMessage } from '@/domain'
import { listByAsync, saveListByAsync } from '@/utils/native'

type ChatToolLayout = 'compact' | 'wide'

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
  }>(),
  {
    height: 'calc(100vh - 66px)',
    layout: 'wide',
    compactWidth: '720px',
    wideMaxWidth: '1080px'
  }
)
const emit = defineEmits(['initial'])

const [think, toggleThink] = useBoolState(false)

const inputValue = ref('')
const modelValue = useUtoolsKvStorage<string>(LocalNameEnum.KEY_AI_COMMON_MODEL, '')

const options = computed(() => useSettingAiStore().options)

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
    baseURL: model.baseUrl,
    apiKey: model.key,
    thinking: think.value ? 'enabled' : 'disabled'
  }
}

const handleSend = () => {
  const requestParams = createRequestParams(inputValue.value)
  if (!requestParams) return

  instance.sendUserMessage(requestParams)
  inputValue.value = ''
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
  let rev: string | undefined = undefined
  if (props.storageKey) {
    const c = await listByAsync<ChatMessage>(props.storageKey)
    if (c) {
      instance.init(c.list)
      rev = c.rev
    }
  }

  // 保存起来
  if (props.storageKey) {
    unWatch = throttledWatch(
      messages,
      async (val) => {
        rev = await saveListByAsync<ChatMessage>(props.storageKey!, cloneDeep(toRaw(val)), rev, 0)
      },
      { throttle: 300, deep: true }
    )
  }

  const messageCount = messages.value.length

  // 如果第一次，则需要注入系统提示词
  if (messages.value.length === 0) {
    await instance.sendSystemMessage(props.prompt)
  }
  emit('initial', messageCount === 0)
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
}

.l-chat-tool__content {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
</style>
