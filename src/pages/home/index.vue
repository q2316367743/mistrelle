<template>
  <page-layout title="首页">
    <div class="p-8px">
      <t-alert>uTools开发脚手架</t-alert>

      <div>分组；{{ group?.name || '无' }}</div>

      <l-chat-sender v-model:input="content" v-model:model="model" />
    </div>
  </page-layout>
</template>
<script lang="ts" setup>
import { useAiGroupStore } from '@/store'
import { AiGroup } from '@/entity/ai'

const route = useRoute()

const group = ref<AiGroup>()

const content = ref('')
const model = ref('')

onMounted(() => {
  group.value = useAiGroupStore().getById(route.params.id as string)
})
</script>
<style scoped lang="less"></style>
