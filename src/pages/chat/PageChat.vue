<template>
  <page-layout :title="title">
      <l-chat-engine
        v-if="initial"
        :functions="functions"
        :prompt="prompt"
        :storage-key="storageKey"
        :placeholder="agent?.placeholder"
      />
      <loading-result v-else title="正在加载中" />
  </page-layout>
</template>
<script lang="ts" setup>
import { AiChatItem, AiAgent, buildAiAgentPrompt } from '@/entity/ai'
import { useAiAgentStore } from '@/store'
import { toolMap } from '@/modules/tool'
import { ToolFunction } from '@/domain'
import { aiChatGet, buildChatChatPath } from '@/modules/chat'
import { MessageUtil } from '@/utils/modal'
import { useSafeBack } from '@/hooks'

const route = useRoute()
const router = useRouter()

const agent = ref<AiAgent>()
const chat = ref<AiChatItem>()
const initial = ref(false)
const functions = shallowRef(new Array<ToolFunction>())

const title = computed(() => {
  if (agent.value) {
    return `${agent.value.name} - ${chat.value?.name || '聊天'}`
  }
  return chat.value?.name || '聊天'
})
const prompt = computed(() => {
  if (agent.value) {
    return buildAiAgentPrompt(agent.value)
  }
  return ''
})

const storageKey = ref()

onMounted(async () => {
  try {
    chat.value = await aiChatGet(route.params.agentId as string, route.params.id as string)
    if (!chat.value) {
      MessageUtil.error('聊天不存在')
      await router.replace('/new//0')
      return
    }
    agent.value = useAiAgentStore().getById(route.params.agentId as string)
    if (agent.value) {
      functions.value = agent.value.tools.map((tool) => toolMap[tool])
    }
    storageKey.value = buildChatChatPath(agent.value?.id || '0', chat.value.id)

    initial.value = true
  } catch (e) {
    MessageUtil.error('初始化失败', e)
    useSafeBack()()
  }
})
</script>
<style scoped lang="less"></style>
