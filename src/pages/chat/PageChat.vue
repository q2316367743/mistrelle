<template>
  <page-layout :title="title">
    <l-chat-engine v-if="storageKey" :storage-key="storageKey" />
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

const chat = computed<AiChatItem | undefined>(() =>
  useAiChatStore().state.find((e) => e.id === (route.params.id as string))
)
const title = computed(() => chat.value?.name || '聊天')
const storageKey = computed(() => (chat.value ? buildChatChatPath(chat.value.id) : ''))
</script>
<style scoped lang="less"></style>
