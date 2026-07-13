<template>
  <page-layout :title="group?.name || '分组'">
    <template #extra>
      <t-button theme="primary" shape="square" variant="text" @click="openNewGroup()">
        <template #icon>
          <add-icon />
        </template>
      </t-button>
    </template>
  </page-layout>
</template>
<script lang="ts" setup>
import { AddIcon } from 'tdesign-icons-vue-next'
import { AiChat, AiGroup } from '@/entity/ai'
import { useAiGroupStore } from '@/store'
import { aiChatList } from '@/store/db/AiChatStore'

const route = useRoute()
const router = useRouter()

const group = ref<AiGroup>()
const chats = ref<Array<AiChat>>([])

const openNewGroup = () => router.push(`/new/${group.value?.id || '0'}`)

onMounted(async () => {
  group.value = useAiGroupStore().getById(route.params.id as string)
  chats.value = await aiChatList(group.value?.id as string)
})
</script>
<style scoped lang="less"></style>
