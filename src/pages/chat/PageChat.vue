<template>
  <page-chat :title="group?.name">
    <l-chat-tool
      v-if="initial"
      :functions="functions"
      :prompt="group?.prompt || ''"
      :storage-key="storageKey"
      :placeholder="group?.placeholder"
      ref="lChatToolRef"
      @initial="handleChatInitial"
    />
    <loading-result v-else title="正在加载中" />
  </page-chat>
</template>
<script lang="ts" setup>
import { AiChatItem, AiGroup } from '@/entity/ai'
import { aiChatGet, useAiChatStore, useAiGroupStore } from '@/store'
import { toolMap } from '@/modules/tool'
import { LocalNameEnum } from '@/global/LocalNameEnum'
import type { ToolFunction } from '@/modules/chat'

const route = useRoute()

const group = ref<AiGroup>()
const chat = ref<AiChatItem>()
const initial = ref(false)
const functions = shallowRef(new Array<ToolFunction>())
const lChatToolRef = ref()

const storageKey = LocalNameEnum.LIST_AI_CHAT(route.params.groupId as string)

const handleChatInitial = (send: boolean) => {
  if (send && chat.value) {
    lChatToolRef.value.sendUserMessage(chat.value.form)
  }
}

onMounted(async () => {
  try {
    console.log('1')
    group.value = useAiGroupStore().getById(route.params.groupId as string)
    if (group.value) {
      console.log('2')
      functions.value = group.value.tools.map((tool) => toolMap[tool])
    }
    console.log('3')
    chat.value = await aiChatGet(route.params.groupId as string, route.params.id as string)
  } finally {
    initial.value = true
  }
})
</script>
<style scoped lang="less"></style>
