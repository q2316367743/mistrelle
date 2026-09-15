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
        <div class="page-new__type-desc">{{ currentFamily?.description }}</div>
        <!-- 子场景维度由注册表派生：家族声明了 variants 即渲染二级选择器（写作→子场景，设计→引擎） -->
        <template v-if="currentFamily?.variants">
          <segmented-control
            v-model="variant"
            :options="currentFamily.variants.options"
            class="page-new__scene"
          />
          <div class="page-new__type-desc">{{ currentVariant?.description }}</div>
        </template>
        <template v-if="type === 'design'">
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
import LChatSender from '@/windows/main/components/chat/sender/LChatSender.vue'
import { useAiChatStore, useSettingDefaultStore } from '@/windows/main/store'
import type {
  ChatRequestParams,
  ChatType,
  DesignScene,
  WritingScene
} from '@/windows/main/modules/chat'
import { SCENE_FAMILIES, SCENE_FAMILY_META } from '@/windows/main/modules/chat/scenes'
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

// 家族选择器选项从注册表派生（单一数据源：SCENE_FAMILIES 顺序即展示顺序）
const typeOptions = SCENE_FAMILIES.map(({ type: value, label, description, icon }) => ({
  value,
  label,
  description,
  icon
}))

const currentFamily = computed(() => SCENE_FAMILIES.find((family) => family.type === type.value))

/** 写作子场景判定（单一判定点：按注册表 writing 家族的选项集校验） */
const isWritingVariant = (val: WritingScene | DesignScene): val is WritingScene =>
  SCENE_FAMILY_META.writing.variants?.options.some((option) => option.value === val) ?? false

/**
 * 子场景统一双写：家族的 variants.field 指明当前值落在哪个存储字段
 * （writing 家族写 scene，design 家族写 engine），发送时原样透传给 ChatRequestParams。
 */
const variant = computed<WritingScene | DesignScene>({
  get: () => (currentFamily.value?.variants?.field === 'designScene' ? engine.value : scene.value),
  set: (val) => {
    if (isWritingVariant(val)) scene.value = val
    else engine.value = val
  }
})

const currentVariant = computed(() =>
  currentFamily.value?.variants?.options.find((option) => option.value === variant.value)
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
