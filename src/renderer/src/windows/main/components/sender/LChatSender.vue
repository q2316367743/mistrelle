<template>
  <div class="l-chat-sender-container">
    <div class="l-chat-sender">
      <div
        class="l-chat-sender__input"
        :class="{ 'is-disabled': loading }"
        @click="focusEditor"
        @dragover.prevent
        @drop="handleContainerDrop"
      >
        <span v-if="showPlaceholder" class="l-chat-sender__placeholder">{{ placeholder }}</span>
        <EditorContent :editor="editor" class="l-chat-sender__editor" />
      </div>
      <div class="l-chat-sender__toolbar">
        <div class="l-chat-sender__toolbar-left">
          <l-chat-attachment
            v-model:agent="agentId"
            v-model:privacy="privacy"
            :sandbox-dir="sandboxDir"
            :workspace-dir="workspaceRef"
            :lock-privacy="lockPrivacy"
            @add-skill="insertSkill"
            @add-tool="insertTool"
            @add-ref-file="insertFile"
          />
          <l-chat-mode-select v-model="mode" />
          <span class="l-chat-sender__divider" />
          <ai-workspace
            v-if="showWorkspace && (!lockWorkspace || workspaceRef)"
            v-model="workspaceRef"
            :readonly="lockWorkspace"
          />
          <l-chat-sender-tags
            :agent-name="selectedAgent?.name"
            :design-style-name="designStyleLabel"
            :privacy="privacy"
            :lock-privacy="lockPrivacy"
            @clear-agent="selectAgent('')"
            @clear-privacy="privacy = false"
          />
        </div>
        <div class="l-chat-sender__toolbar-right">
          <l-chat-token-usage
            v-if="tokenUsage"
            :context-tokens="tokenUsage.contextTokens"
            :context-window="tokenUsage.contextWindow"
            :breakdown="tokenUsage.breakdown"
          />
          <ai-model-select v-model="modelKey" v-model:thinking="thinking" v-model:effort="effort" />
          <t-button
            v-if="loading"
            shape="circle"
            theme="danger"
            variant="outline"
            title="停止"
            @click="handleStop"
          >
            <template #icon> <stop-circle-icon /> </template>
          </t-button>
          <t-button
            v-else
            shape="circle"
            theme="primary"
            title="发送"
            :disabled="!canSend"
            @click="handleSend"
          >
            <template #icon> <arrow-up-icon /> </template>
          </t-button>
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { EditorContent } from '@tiptap/vue-3'
import { useSettingAiStore, useSettingDefaultStore, useDesignStyleStore, useAiAgentStore } from '@/windows/main/store'
import { loadChatFiles, type ChatFileRef } from '@/utils/chatSender'
import type { ThinkingEffort, TokenBreakdown } from '@/domain'
import type { ChatSenderInitial } from './chatSenderInitial'
import { useChatSenderEditor } from './useChatSenderEditor'
import { DEFAULT_CHAT_MODE } from './chatModeOptions'
import AiModelSelect from '@/windows/main/components/AiModelSelect.vue'
import AiWorkspace from '@/windows/main/components/AiWorkspace.vue'
import LChatAttachment from './LChatAttachment.vue'
import LChatModeSelect from './LChatModeSelect.vue'
import LChatSenderTags from './LChatSenderTags.vue'
import LChatTokenUsage from './LChatTokenUsage.vue'
import type { ChatRequestParams, ChatType, DesignScene, WritingScene } from '@/windows/main/modules/chat'
import { AiChatMode } from '@/entity'
import { ArrowUpIcon, StopCircleIcon } from 'tdesign-icons-vue-next'

const props = withDefaults(
  defineProps<{
    initial?: ChatSenderInitial
    loading?: boolean
    placeholder?: string
    sandboxDir?: string
    /** 是否显示工作空间选择（设计编辑器等无工作空间场景传 false） */
    showWorkspace?: boolean
    /** 锁定工作空间（聊天室）：未选择时隐藏，已选择时只读不可修改 */
    lockWorkspace?: boolean
    /** 锁定隐私标记（聊天室）：隐私为创建后锁定属性，开关禁用、tag 不可关闭，仅回显创建时的选择 */
    lockPrivacy?: boolean
    tokenUsage?: {
      contextTokens: number
      contextWindow: number
      breakdown: TokenBreakdown
    }
  }>(),
  {
    initial: () => ({}),
    loading: false,
    tokenUsage: undefined,
    placeholder: '描述任务，/ 调用技能，# 使用工具，@ 添加上下文',
    sandboxDir: '',
    showWorkspace: true,
    lockWorkspace: false,
    lockPrivacy: false
  }
)
const emit = defineEmits<{
  send: [message: ChatRequestParams]
  stop: []
}>()

const sandboxFiles = ref<ChatFileRef[]>([])
const modelKey = ref(props.initial.model || useSettingDefaultStore().state.defaultAssistantModel)
const thinking = ref(props.initial.thinking ?? true)
const effort = ref<ThinkingEffort>(props.initial.effort ?? 'high')
const agentId = ref(props.initial.agentId || '')
/** 权限模式：聊天室由会话持有（v-model:mode 双向绑定，改动实时落盘并作用于下一个工具调用）；新建页为组件内部状态 */
const mode = defineModel<AiChatMode>('mode', { default: DEFAULT_CHAT_MODE })
const privacy = ref(props.initial.privacy ?? false)
const type = ref<ChatType>(props.initial.type ?? 'office')
const writingScene = ref<WritingScene>(props.initial.writingScene ?? 'article')
const designScene = ref<DesignScene>(props.initial.designScene ?? 'canvas')
const designStyleId = ref(props.initial.designStyleId ?? '')
const workspaceRef = ref(props.initial.workspace || '')
const files = computed(() => [...sandboxFiles.value])
const selectedAgent = computed(() => useAiAgentStore().getById(agentId.value))

/** 设计风格名称：从缓存列表取（列表缓存、详情不缓存），风格被删除时回退空串 */
const designStyleName = computed(() => useDesignStyleStore().getById(designStyleId.value)?.name ?? '')

/** 设计风格标签文案：未选定风格时不展示，风格被删除时回退通用文案 */
const designStyleLabel = computed(() =>
  designStyleId.value ? designStyleName.value || '设计风格' : ''
)

const {
  editor,
  inputValue,
  canSend,
  showPlaceholder,
  getContents,
  focusEditor,
  setText,
  setEditable,
  insertSkill,
  insertTool,
  insertFile,
  insertFileByPath,
  resolveFilePath,
  clearEditor,
  addCanvasNode,
  addHtmlElementNode
} = useChatSenderEditor({
  content: props.initial.input || '',
  editable: !props.loading,
  sandboxDir: () => props.sandboxDir,
  workspace: workspaceRef,
  files,
  onSubmit: () => handleSend()
})

const selectAgent = (res: string) => {
  agentId.value = res
}

const buildUserMessage = (): ChatRequestParams => {
  const [provide = '', model = ''] = modelKey.value.split(':')
  return {
    message: {
      content: getContents(),
      model,
      provide,
      thinking: thinking.value,
      reasoning_effort: effort.value
    },
    mode: mode.value,
    privacy: privacy.value,
    agentId: agentId.value,
    workspace: workspaceRef.value,
    type: type.value,
    writingScene: writingScene.value,
    designScene: designScene.value,
    designStyleId: designStyleId.value || undefined
  }
}

const handleSend = () => {
  if (!canSend.value) return
  emit('send', buildUserMessage())
  clearEditor()
}

const handleStop = () => emit('stop')

const handleContainerDrop = async (event: DragEvent) => {
  const editorDom = editor.value?.view.dom
  if (editorDom?.contains(event.target as Node)) return
  const dropped = event.dataTransfer?.files
  if (!dropped || dropped.length === 0) return
  const filePath = await resolveFilePath(dropped[0])
  if (filePath) insertFileByPath(filePath)
}

// =================================== 监听 props 初始对象 ===================================
// 初始化参数由父组件一次性提供，异步水合 / 恢复上次会话配置时整体重建对象引用，
// 浅监听引用变化统一应用，无需逐个字段监听；各字段沿用原 fallback 语义
watch(
  () => props.initial,
  (init) => {
    if (init.input !== undefined && inputValue.value !== init.input) setText(init.input)
    if (init.model !== undefined) {
      modelKey.value = init.model || useSettingDefaultStore().state.defaultAssistantModel
    }
    if (init.thinking !== undefined) thinking.value = init.thinking
    if (init.effort !== undefined) effort.value = init.effort
    if (init.agentId !== undefined) agentId.value = init.agentId
    if (init.privacy !== undefined) privacy.value = init.privacy
    if (init.type !== undefined) type.value = init.type
    if (init.writingScene !== undefined) writingScene.value = init.writingScene
    if (init.designScene !== undefined) designScene.value = init.designScene
    if (init.designStyleId !== undefined) designStyleId.value = init.designStyleId
    if (init.workspace !== undefined) workspaceRef.value = init.workspace
  }
)
watch(
  () => props.loading,
  (value) => setEditable(!value)
)
watch(
  () => props.sandboxDir,
  async (value) => {
    sandboxFiles.value = []
    if (!value) return
    const inputsDir = window.preload.path.join(value, 'inputs')
    const outputsDir = window.preload.path.join(value, 'outputs')
    const [inputs, outputs] = await Promise.all([
      loadChatFiles(inputsDir),
      loadChatFiles(outputsDir)
    ])
    sandboxFiles.value = [...inputs, ...outputs]
  },
  { immediate: true }
)

// =================================== 生命周期 ===================================

onMounted(async () => {
  setText(props.initial.input || '')
  await useSettingAiStore().initPromise
})

defineExpose({ addCanvasNode, addHtmlElementNode })
</script>
<style scoped lang="less">
@import 'LChatSender.less';
</style>
