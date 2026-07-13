<template>
  <div :style="{ height, display: 'flex', flexDirection: 'column' }">
    <!-- 消息列表 -->
    <r-chat-list
      :messages="messages"
      :clear-history="messages.length > 1 && status !== 'streaming'"
      style="flex: 1"
      @clear="handleClear"
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
                shape="circle"
                :theme="think ? 'primary' : 'default'"
                @click="toggleThink()"
              >
                <SystemSumIcon />
              </t-button>
            </div>
          </div>
        </div>
      </template>
    </ChatSender>
  </div>
</template>
<script lang="ts" setup>
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

const props = withDefaults(
  defineProps<{
    functions: ToolFunction[]
    prompt: string
    height?: string
    storageKey?: string
    placeholder?: string
  }>(),
  {
    height: 'calc(100vh - 73px)'
  }
)
const emit = defineEmits(['initial'])

const [think, toggleThink] = useBoolState(false)

const inputValue = ref('')
const modelValue = useUtoolsKvStorage<string>(LocalNameEnum.KEY_AI_COMMON_MODEL, '')

const options = computed(() => useSettingAiStore().options)

const instance = new ToolChat({ functions: props.functions })

const { messages, status } = instance

const handleSend = () => {
  const model = useSettingAiStore().optionMap.get(modelValue.value)
  if (!model) return MessageUtil.error('请选择模型')
  instance.init({
    baseURL: model.baseUrl,
    apiKey: model.key
  })
  instance.sendUserMessage({
    content: inputValue.value,
    model: model.identifier,
    thinking: model ? (think.value ? 'enabled' : 'disabled') : 'disabled'
  })
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

let unWatch: (() => void) | null = null

onMounted(async () => {
  if (props.storageKey) {
    const c = await listByAsync<ChatMessage>(props.storageKey)
    if (c) {
      instance.init(
        {
          baseURL: '',
          apiKey: ''
        },
        c.list
      )
    }
  }

  // 保存起来
  if (props.storageKey) {
    unWatch = throttledWatch(
      messages,
      async (val) => {
        await saveListByAsync<ChatMessage>(props.storageKey!, cloneDeep(val))
      },
      { throttle: 300, deep: true }
    )
  }

  // 如果第一次，则需要注入系统提示词
  if (messages.value.length === 0) {
    await instance.sendSystemMessage(props.prompt)
  }
  emit('initial')
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
<style scoped lang="less"></style>
