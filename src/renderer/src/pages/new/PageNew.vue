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
        <template v-if="type === 'design' || type === 'ppt'">
          <t-select
            v-model="designStyleId"
            clearable
            filterable
            placeholder="选择设计风格（可选）"
            class="page-new__style"
            :popup-props="{ overlayClassName: 'page-new-style-overlay' }"
          >
            <t-option v-for="s in designStyleOptions" :key="s.id" :value="s.id" :label="s.name">
              <div class="page-new__style-option">
                <span class="page-new__style-option-name">
                  {{ s.name }}
                  <t-tag v-if="s.isSystem" theme="primary" variant="light" size="small">内置</t-tag>
                </span>
                <span class="page-new__style-option-desc">{{ s.description }}</span>
              </div>
            </t-option>
          </t-select>
        </template>
      </div>
      <div class="page-new__sender">
        <l-chat-sender :initial="{ model, type, writingScene: scene }" @send="handleSend" />
      </div>
    </div>
  </page-layout>
</template>
<script lang="ts" setup>
import { useAiChatStore, useDesignStyleStore, useSettingDefaultStore } from '@/store'
import type { ChatRequestParams, ChatType, WritingScene } from '@/modules/chat'
import { CHAT_TYPE_OPTIONS, WRITING_SCENE_OPTIONS } from '@/modules/chat'
import { MessageUtil } from '@/utils/modal'
import { toggleCollapsed } from '@/global/BeanFactory'

/** 显式组件名：App.vue 的 keep-alive 按此名对「新建聊天」页保活 */
defineOptions({ name: 'PageNew' })

const router = useRouter()

const show = ref(true)
const model = ref('')
const type = ref<ChatType>('office')
const scene = ref<WritingScene>('article')
const designStyleId = ref('')

const typeOptions = CHAT_TYPE_OPTIONS
const sceneOptions = WRITING_SCENE_OPTIONS

const currentOption = computed(() => typeOptions.find((option) => option.value === type.value))
const currentScene = computed(() => sceneOptions.find((option) => option.value === scene.value))

const designStyleStore = useDesignStyleStore()
/** 设计风格选项（列表缓存：预设 + 用户自建），补充 isSystem 标记供模板区分内置项 */
const designStyleOptions = computed(() =>
  designStyleStore.all.map((s) => ({ ...s, isSystem: 'isSystem' in s && s.isSystem }))
)

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

/** 重置页面全部数据：类型、场景、设计风格、模型（输入框内容由 LChatSender 发送成功后自行清空） */
const resetPageData = () => {
  type.value = 'office'
  scene.value = 'article'
  designStyleId.value = ''
  model.value = useSettingDefaultStore().state.defaultAssistantModel
  setTimeout(() => {
    show.value = false
    nextTick(() => {
      show.value = true
    })
  }, 100)
}

watch(type, (val) => {
  if (val !== 'design' && val !== 'ppt') designStyleId.value = ''
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

.page-new__style-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 2px 0;
}

.page-new__style-option-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--td-font-size-body-medium);
  color: var(--td-text-color-primary);
}

.page-new__style-option-desc {
  font-size: var(--td-font-size-body-small);
  color: var(--td-text-color-secondary);
}

.page-new__sender {
  width: 100%;
}
</style>
<style lang="less">
/* 自定义 select 下拉选项面板（teleport 到 body，需全局样式；类名见 popup-props.overlayClassName） */
.page-new-style-overlay {
  .t-select-option {
    height: 100%;
    padding: 8px;
  }
}
</style>
