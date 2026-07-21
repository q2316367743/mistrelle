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
          v-model:input="content"
          v-model:model="model"
          v-model:think="think"
          :placeholder="agent?.placeholder"
          @send="handleSend"
        />
      </div>
    </div>
  </page-layout>
</template>
<script lang="ts" setup>
import { useAiChatStore, useAiAgentStore, useSettingDefaultStore } from '@/store'
import { AiAgent } from '@/entity/ai'
import { MessageUtil } from '@/utils/modal'

const route = useRoute()
const router = useRouter()

const agent = ref<AiAgent>()

const content = ref('')
const model = ref('')
const think = ref(true)

const title = computed(() => {
  if (agent.value) {
    return `${agent.value.name} | 新建对话`
  }
  return '新建对话'
})

const handleSend = async () => {
  const agentId = agent.value?.id || '0'
  if (!content.value) return MessageUtil.error('请输入内容')
  if (!model.value) return MessageUtil.error('请选择模型')
  const id = await useAiChatStore().add(
    {
      content: content.value,
      model: model.value,
      thinking: think.value ? 'enabled' : 'disabled'
    },
    agentId
  )
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
