<template>
  <page-chat :title="group?.name">
    <l-chat-tool
      v-if="initial"
      :functions="functions"
      :prompt="group?.prompt || ''"
      :storage-key="storageKey"
      :placeholder="group?.placeholder"
      ref="lChatToolRef"
    />
    <loading-result v-else title="正在加载中" />
  </page-chat>
</template>
<script lang="ts" setup>
import { AiGroup } from '@/entity/ai'
import { aiChatGet, useAiChatStore, useAiGroupStore } from '@/store'
import { toolMap } from '@/modules/tool'
import { LocalNameEnum } from '@/global/LocalNameEnum'
import type { ToolFunction } from '@/modules/chat'

const route = useRoute()

const group = ref<AiGroup>()
const initial = ref(false)
const functions = shallowRef(new Array<ToolFunction>())
const lChatToolRef = ref()

const storageKey = LocalNameEnum.LIST_AI_CHAT(route.params.groupId as string)

onMounted(async () => {
  try {
    group.value = useAiGroupStore().getById(route.params.groupId as string)
    if (group.value) {
      functions.value = group.value.tools.map((tool) => toolMap[tool])
    }
    const chat = await aiChatGet(route.params.groupId as string, route.params.id as string)
    if (chat) {
      lChatToolRef.value.sendUserMessage(chat.form)
    }
  } finally {
    initial.value = true
  }
})
</script>
<style scoped lang="less"></style>
