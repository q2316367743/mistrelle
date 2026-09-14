<template>
  <page-layout>
    <div v-if="show" class="page-new">
      <div class="page-new__hero">
        <div class="page-new__title">Hi，今天从哪里开始</div>
        <div class="page-new__subtitle">
          选择一种聊天类型，创建后类型锁定，获得专属侧边栏与 AI 能力
        </div>
      </div>
      <div class="page-new__types">
        <segmented-control v-model="type" :options="typeOptions" />
        <div class="page-new__type-desc">{{ currentOption?.description }}</div>
        <template v-if="type === 'writing'">
          <segmented-control v-model="scene" :options="sceneOptions" class="page-new__scene" />
          <div class="page-new__type-desc">{{ currentScene?.description }}</div>
        </template>
        <template v-if="type === 'design'">
          <segmented-control v-model="engine" :options="engineOptions" class="page-new__scene" />
          <div class="page-new__type-desc">{{ currentEngine?.description }}</div>
          <style-select v-model="designStyleId" class="page-new__style" />
        </template>
      </div>
      <div class="page-new__sender">
        <l-chat-sender
          :initial="{
            model,
            type,
            writingScene: scene,
            designScene: engine,
            workspace: prefillWorkspace || undefined
          }"
          @send="handleSend"
        />
      </div>
    </div>
  </page-layout>
</template>
<script lang="ts" setup>
import { useAiChatStore, useSettingDefaultStore } from '@/windows/main/store'
import type {
  ChatRequestParams,
  ChatType,
  DesignScene,
  WritingScene
} from '@/windows/main/modules/chat'
import {
  CHAT_TYPE_OPTIONS,
  DESIGN_SCENE_OPTIONS,
  WRITING_SCENE_OPTIONS
} from '@/windows/main/modules/chat'
import { MessageUtil } from '@/utils/modal'
import { toggleCollapsed } from '@/global/BeanFactory'

/** 显式组件名：App.vue 的 keep-alive 按此名对「新建聊天」页保活 */
defineOptions({ name: 'PageNew' })

const router = useRouter()
const route = useRoute()

const show = ref(true)
const model = ref('')
const type = ref<ChatType>('writing')
const scene = ref<WritingScene>('article')
const engine = ref<DesignScene>('canvas')
const designStyleId = ref('')

// 项目分组头「新建聊天」入口经 /new?workspace=<目录> 预填工作目录；
// 传 undefined（无预填）避免每次切换类型时用空值覆盖用户手动选择的目录
const prefillWorkspace = ref<string>()
watch(
  () => route.query.workspace,
  (val) => {
    prefillWorkspace.value = typeof val === 'string' ? val : undefined
  },
  { immediate: true }
)

const typeOptions = CHAT_TYPE_OPTIONS
const sceneOptions = WRITING_SCENE_OPTIONS
const engineOptions = DESIGN_SCENE_OPTIONS

const currentOption = computed(() => typeOptions.find((option) => option.value === type.value))
const currentScene = computed(() => sceneOptions.find((option) => option.value === scene.value))
const currentEngine = computed(() => engineOptions.find((option) => option.value === engine.value))

const handleSend = async (message: ChatRequestParams) => {
  if (!message.message.model) {
    MessageUtil.error('请选择模型')
    return
  }
  const id = await useAiChatStore().add({
    ...message,
    designStyleId: designStyleId.value || undefined
  })
  // 页面被 keep-alive 保活，不会随跳转卸载：发送后立即重置全部页面数据，返回本页时保持干净状态
  await router.push(`/chat/${id}`)
  toggleCollapsed(true)
  resetPageData()
}

/** 重置页面全部数据：类型、场景、引擎、设计风格、模型、预填工作目录（输入框内容由 LChatSender 发送成功后自行清空） */
const resetPageData = () => {
  type.value = 'office'
  scene.value = 'article'
  engine.value = 'canvas'
  designStyleId.value = ''
  prefillWorkspace.value = undefined
  model.value = useSettingDefaultStore().state.defaultAssistantModel
  setTimeout(() => {
    show.value = false
    nextTick(() => {
      show.value = true
    })
  }, 100)
}

watch(type, (val) => {
  if (val !== 'design') {
    designStyleId.value = ''
    engine.value = 'canvas'
  }
})

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

.page-new__style {
  width: 360px;
}

.page-new__sender {
  width: 100%;
}
</style>
