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
          :placeholder="group?.placeholder"
          @send="handleSend"
        />
      </div>
    </div>
  </page-layout>
</template>
<script lang="ts" setup>
import { useAiChatStore, useAiGroupStore, useSettingDefaultStore } from '@/store'
import { AiGroup } from '@/entity/ai'

const route = useRoute()
const router = useRouter()

const group = ref<AiGroup>()

const content = ref('')
const model = ref('')
const think = ref(true)

const title = computed(() => {
  if (group.value) {
    return `${group.value.name} | 新建对话`
  }
  return '新建对话'
})

const handleSend = async () => {
  const id = await useAiChatStore().add(
    {
      content: content.value,
      model: model.value,
      thinking: think.value ? 'enabled' : 'disabled'
    },
    group.value?.id || '0'
  )
  await router.push(`/chat/${group.value?.id || '0'}/${id}`)
}

onMounted(() => {
  group.value = useAiGroupStore().getById(route.params.id as string)
  model.value = group.value?.model || useSettingDefaultStore().state.defaultAssistantModel
})
</script>
<style scoped lang="less"></style>
