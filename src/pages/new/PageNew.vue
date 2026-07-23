<template>
  <page-layout title="新建对话">
    <div class="p-8px flex flex-col items-center" style="height: calc(100% - 16px)">
      <div class="flex-1 flex flex-col items-center justify-center">
        <div style="font-size: var(--td-font-size-headline-medium); font-weight: bold">
          Hi, 今天从哪里开始
        </div>
      </div>
      <div class="mt-auto w-full">
        <l-chat-sender :initial-model="model" placeholder="今天要做点什么呢？" @send="handleSend" />
      </div>
    </div>
  </page-layout>
</template>
<script lang="ts" setup>
import { useAiChatStore, useSettingDefaultStore } from '@/store'
import { ChatRequestParams } from '@/modules/chat'

const router = useRouter()

const model = ref('')

const handleSend = async (message: ChatRequestParams) => {
  const id = await useAiChatStore().add(message, '')
  await router.push(`/chat/${id}`)
}

onMounted(async () => {
  model.value = useSettingDefaultStore().state.defaultAssistantModel
})
</script>
<style scoped lang="less"></style>
