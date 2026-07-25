<template>
  <page-layout :title="title">
    <l-chat-engine v-if="storageKey" :storage-key="storageKey" :chat-id="chatId" />
    <loading-result v-else title="正在加载中" />
  </page-layout>
</template>
<script lang="ts" setup>
import { AiChatItem, AiAgent } from '@/entity/ai'
import { useAiAgentStore, useAiChatStore } from '@/store'
import { aiChatGet, buildChatChatPath } from '@/modules/chat'
import { MessageUtil } from '@/utils/modal'
import { useSafeBack } from '@/hooks'

const route = useRoute()

const chat = ref<AiChatItem>()
const storageKey = ref<string>()
const chatId = ref('')

const title = computed(() => chat.value?.name || '聊天')

watch(
  () => route.params.id,
  (val) => {
    const res = useAiChatStore().state.find((e) => e.id === (val as string))
    if (res) {
      chat.value = undefined
      storageKey.value = ''
      nextTick(() => {
        chat.value = res
        chatId.value = res.id
        storageKey.value = buildChatChatPath(res.id)
      })
    }
  },
  { immediate: true }
)
</script>
<style scoped lang="less"></style>
