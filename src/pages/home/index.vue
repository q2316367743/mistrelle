<template>
  <page-layout title="新建对话">
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
          @send="handleSend"
        />
      </div>
    </div>
  </page-layout>
</template>
<script lang="ts" setup>
import { useAiChatStore, useSettingDefaultStore } from '@/store'

const router = useRouter()

const content = ref('')
const model = ref('')
const think = ref(true)

const handleSend = async () => {
  const id = await useAiChatStore().add(
    {
      content: content.value,
      model: model.value,
      thinking: think.value ? 'enabled' : 'disabled'
    },
    '0'
  )
  await router.push(`/chat/0/${id}`)
}

onMounted(() => {
  model.value = useSettingDefaultStore().state.defaultAssistantModel
})
</script>
<style scoped lang="less"></style>
