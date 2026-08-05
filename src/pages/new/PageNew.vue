<template>
  <page-layout title="新建对话">
    <div class="page-new">
      <div class="page-new__hero">
        <div class="page-new__title">Hi，今天从哪里开始</div>
        <div class="page-new__subtitle">选择一种聊天类型，创建后类型锁定，获得专属侧边栏与 AI 能力</div>
      </div>
      <div class="page-new__types">
        <segmented-control v-model="type" :options="typeOptions" />
        <div class="page-new__type-desc">{{ currentOption?.description }}</div>
        <template v-if="type === 'writing'">
          <segmented-control v-model="scene" :options="sceneOptions" class="page-new__scene" />
          <div class="page-new__type-desc">{{ currentScene?.description }}</div>
        </template>
      </div>
      <div class="page-new__sender">
        <l-chat-sender
          :initial-model="model"
          :initial-type="type"
          :initial-writing-scene="scene"
          @send="handleSend"
        />
      </div>
    </div>
  </page-layout>
</template>
<script lang="ts" setup>
import { useAiChatStore, useSettingDefaultStore } from '@/store'
import type { ChatRequestParams, ChatType, WritingScene } from '@/modules/chat'
import { CHAT_TYPE_OPTIONS, WRITING_SCENE_OPTIONS } from '@/modules/chat'
import { MessageUtil } from '@/utils/modal'

const router = useRouter()

const model = ref('')
const type = ref<ChatType>('office')
const scene = ref<WritingScene>('article')

const typeOptions = CHAT_TYPE_OPTIONS
const sceneOptions = WRITING_SCENE_OPTIONS

const currentOption = computed(() => typeOptions.find((option) => option.value === type.value))
const currentScene = computed(() => sceneOptions.find((option) => option.value === scene.value))

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

.page-new__types {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 24px;
}

.page-new__type-desc {
  font-size: var(--td-font-size-body-small);
  color: var(--td-text-color-secondary);
}

.page-new__sender {
  width: 100%;
}
</style>
