<template>
  <page-layout :title="title">
    <div class="p-8px flex flex-col items-center" style="height: calc(100% - 16px)">
      <div class="flex-1 flex flex-col items-center justify-center">
        <div style="font-size: var(--td-font-size-headline-medium); font-weight: bold">
          Hi, 今天从哪里开始
        </div>
      </div>
      <div class="mt-auto w-full">
        <l-chat-sender
          :initial-model="model"
          :placeholder="agent?.placeholder"
          @send="handleSend"
        />
      </div>
    </div>
  </page-layout>
</template>
<script lang="ts" setup>
import { useAiAgentStore, useAiChatStore, useSettingDefaultStore } from '@/store'
import { AiAgent } from '@/entity/ai'
import type { UserMessage } from '@/domain'
import type { AiChatDraft } from '@/entity/ai'

const route = useRoute()
const router = useRouter()

const agent = ref<AiAgent>()
const model = ref('')

const title = computed(() => {
  if (agent.value) {
    return `${agent.value.name} | 新建对话`
  }
  return '新建对话'
})

const handleSend = async (message: UserMessage) => {
  const agentId = agent.value?.id || '0'
  const draft: AiChatDraft = {
    content: message.content,
    model: message.model,
    provide: message.provide,
    thinking: message.thinking,
    reasoning_effort: message.reasoning_effort
  }
  const id = await useAiChatStore().add(draft, agentId)
  await router.push(`/chat/${agentId}/${id}`)
}

onMounted(async () => {
  agent.value = useAiAgentStore().getById(route.params.id as string)
  model.value = agent.value?.model || useSettingDefaultStore().state.defaultAssistantModel

  watch(
    () => route.params.id,
    (val) => {
      if (val === '0') {
        agent.value = undefined
      } else {
        agent.value = useAiAgentStore().getById(route.params.id as string)
      }
      model.value = agent.value?.model || useSettingDefaultStore().state.defaultAssistantModel
    }
  )
})
</script>
<style scoped lang="less"></style>
