<template>
  <page-layout title="新建对话">
    <div class="page-new">
      <div class="page-new__hero">
        <div class="page-new__title">Hi，今天从哪里开始</div>
        <div class="page-new__subtitle">描述你的想法，我来帮你搞定</div>
      </div>
      <div class="page-new__sender">
        <l-chat-sender :initial-model="model" @send="handleSend" />
      </div>
    </div>
  </page-layout>
</template>
<script lang="ts" setup>
import { useAiChatStore, useSettingDefaultStore } from '@/store'
import { ChatRequestParams } from '@/modules/chat'
import { MessageUtil } from '@/utils/modal'

const router = useRouter()

const model = ref('')

const handleSend = async (message: ChatRequestParams) => {
  if (!message.message.model) {
    MessageUtil.error('请选择模型')
    return
  }
  const id = await useAiChatStore().add(message)
  await router.push(`/chat/${id}`)
}

watch(
  () => useSettingDefaultStore().state.defaultAssistantModel,
  (val) => {
    model.value = val
  },
  { immediate: true }
)
</script>
<style scoped lang="less">
.page-new {
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
  padding: 24px 48px;
  box-sizing: border-box;
}

.page-new__hero {
  margin-bottom: 24px;
}

.page-new__title {
  font-size: var(--td-font-size-headline-medium);
  font-weight: bold;
  color: var(--td-text-color-primary);
}

.page-new__subtitle {
  margin-top: 8px;
  font-size: var(--td-font-size-body-medium);
  color: var(--td-text-color-secondary);
}

.page-new__sender {
  width: 100%;
}

.page-new__suggestions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  flex-wrap: wrap;
}

.page-new__suggestion {
  cursor: pointer;
  transition: color 0.2s;

  &:hover {
    color: var(--td-brand-color);
  }
}
</style>
