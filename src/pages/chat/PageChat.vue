<template>
  <page-layout :title="title">
    <div class="p-8px">
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
    </div>
  </page-layout>
</template>
<script lang="ts" setup>
import { AiChatItem, AiFriend, AiGroup } from '@/entity/ai'
import { aiChatGet, useAiFriendStore, useAiGroupStore } from '@/store'
import { toolMap } from '@/modules/tool'
import { LocalNameEnum } from '@/global/LocalNameEnum'
import type { ToolFunction } from '@/modules/chat'
import { MessageUtil } from '@/utils/modal'

const route = useRoute()
const router = useRouter()

const group = ref<AiGroup | AiFriend>()
const chat = ref<AiChatItem>()
const initial = ref(false)
const functions = shallowRef(new Array<ToolFunction>())
const lChatToolRef = ref()

const title = computed(() => {
  if (group.value) {
    return `${group.value.name} - ${chat.value?.name || '聊天'}`
  }
  return chat.value?.name || '聊天'
})

const storageKey = LocalNameEnum.LIST_AI_CHAT(route.params.id as string)

const handleChatInitial = (send: boolean) => {
  if (send && chat.value) {
    lChatToolRef.value.sendUserMessage(chat.value.form)
  }
}

onMounted(async () => {
  try {
    chat.value = await aiChatGet(route.params.groupId as string, route.params.id as string)
    if (!chat.value) {
      MessageUtil.error('聊天不存在')
      await router.replace('/new/single/0')
      return
    }
    if (chat.value.form.type === 'group') {
      group.value = useAiGroupStore().getById(chat.value.form.relationId)
    } else if (chat.value.form.type === 'friend') {
      group.value = await useAiFriendStore().getById(chat.value.form.relationId)
    }
    if (group.value) {
      functions.value = group.value.tools.map((tool) => toolMap[tool])
    }
  } finally {
    initial.value = true
  }
})
</script>
<style scoped lang="less"></style>
