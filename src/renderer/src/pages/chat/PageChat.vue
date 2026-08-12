<template>
    <l-chat-engine
      v-if="storageKey && chat"
      :key="storageKey"
      :chat-id="chat.id"
      :chat-name="chat.name"
      :storage-key="storageKey"
    />
    <loading-result v-else title="正在加载中" />
</template>
<script lang="ts" setup>
import { AiChatItem, AiAgent } from '@/entity/ai'
import { useAiAgentStore, useAiChatStore } from '@/store'
import { aiChatGet, buildChatMainPath } from '@/modules/chat'
import { MessageUtil } from '@/utils/modal'
import { useSafeBack } from '@/hooks'

const route = useRoute()

const chat = ref<AiChatItem>()
const storageKey = ref<string>()

watch(
  () => route.params.id,
  (val) => {
    const res = useAiChatStore().state.find((e) => e.id === (val as string))
    if (res) {
      chat.value = undefined
      storageKey.value = ''
      nextTick(() => {
        chat.value = res
        storageKey.value = buildChatMainPath(res.id)
      })
    }
  },
  { immediate: true }
)
</script>
<style scoped lang="less"></style>
