<template>
  <div class="l-chat-sender-container">
    <div class="l-chat-sender">
      <div
        class="l-chat-sender__input"
        :class="{ 'is-disabled': loading }"
        @click="focusInput"
        @dragover.prevent
        @drop="handleContainerDrop"
      >
        <span v-if="showPlaceholder" class="l-chat-sender__placeholder">{{ placeholder }}</span>
        <EditorContent :editor="editor" class="l-chat-sender__editor" />
      </div>
      <div class="l-chat-sender__footer">
        <div class="l-chat-sender__footer-left">
          <l-chat-attachment
            v-model:agent="agentId"
            v-model:mode="mode"
            :sandbox-dir="sandboxDir"
            :workspace-dir="workspaceRef"
            @add-skill="insertSkill"
            @add-tool="insertTool"
            @add-ref-file="insertFile"
          />
          <ai-workspace
            v-if="showWorkspace && (!lockWorkspace || workspaceRef)"
            v-model="workspaceRef"
            :readonly="lockWorkspace"
          />
          <t-tag
            v-if="designStyleId"
            theme="warning"
            variant="light"
            size="large"
            :title="designStyleName"
          >
            <template #icon>
              <palette-icon />
            </template>
            {{ designStyleName || '设计风格' }}
          </t-tag>
          <t-tag
            v-if="mode === 1"
            theme="primary"
            variant="light"
            closable
            size="large"
            @close="handleClearMode"
          >
            <template #icon>
              <task-icon />
            </template>
            计划
          </t-tag>
          <t-tag
            v-else-if="mode === 2"
            theme="warning"
            variant="light"
            closable
            size="large"
            @close="handleClearMode"
          >
            <template #icon>
              <lock-off-icon />
            </template>
            完全访问
          </t-tag>
        </div>
        <div class="flex gap-8px items-center">
          <t-popup
            v-if="tokenUsage"
            trigger="click"
            placement="top"
            :overlay-inner-style="tokenPopupStyle"
          >
            <t-button
              shape="circle"
              variant="text"
              theme="default"
              class="l-chat-sender__token-btn"
            >
              <t-progress
                :percentage="tokenPercent"
                theme="circle"
                :size="18"
                :label="false"
                :stroke-width="2"
              />
            </t-button>
            <template #content>
              <token-usage-panel
                :context-tokens="tokenUsage.contextTokens"
                :context-window="tokenUsage.contextWindow"
                :breakdown="tokenUsage.breakdown"
              />
            </template>
          </t-popup>
          <ai-model-select v-model="modelKey" v-model:thinking="thinking" v-model:effort="effort" />
          <t-button v-if="loading" theme="danger" variant="outline" @click="handleStop">
            停止
          </t-button>
          <t-button v-else theme="primary" :disabled="!canSend" @click="handleSend">发送</t-button>
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Mention from '@tiptap/extension-mention'
import { mergeAttributes, Node as TiptapNode } from '@tiptap/core'
import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { localSkillList, type LocalSkill } from '@/modules/skill'
import { useSettingAiStore, useSettingDefaultStore, useDesignStyleStore } from '@/store'
import { loadChatFiles, type ChatFileRef } from '@/utils/chatSender'
import type {
  SkillItem,
  ThinkingEffort,
  TokenBreakdown,
  ToolItem,
  UserMessageContent
} from '@/domain'
import {
  buildFileSuggestion,
  buildSkillSuggestion,
  buildToolSuggestion,
  skillMentionPluginKey,
  fileMentionPluginKey,
  toolMentionPluginKey,
  type ToolSuggestionItem
} from './mentionSuggestion'
import { serializeEditorContent } from './chatSenderContent'
import type { ChatSenderInitial } from './chatSenderInitial'
import type { CanvasNodeRef } from '@/components/chat/design/canvasNodeBridge'
import type { PptNodeRef } from '@/components/chat/ppt/pptNodeBridge'
import type { ChatRequestParams, ChatType, WritingScene } from '@/modules/chat'
import { AiChatMode } from '@/entity'
import { LockOffIcon, PaletteIcon, TaskIcon } from 'tdesign-icons-vue-next'

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
    lockWorkspace: false
  }
)
const emit = defineEmits<{
  send: [message: ChatRequestParams]
  stop: []
}>()

const skills = ref<LocalSkill[]>([])
const sandboxFiles = ref<ChatFileRef[]>([])
const modelKey = ref(props.initial.model || useSettingDefaultStore().state.defaultAssistantModel)
const thinking = ref(props.initial.thinking ?? true)
const effort = ref<ThinkingEffort>(props.initial.effort ?? 'high')
const agentId = ref(props.initial.agentId || '')
const mode = ref<AiChatMode>(props.initial.mode ?? 0)
const type = ref<ChatType>(props.initial.type ?? 'office')
const writingScene = ref<WritingScene>(props.initial.writingScene ?? 'article')
const designStyleId = ref(props.initial.designStyleId ?? '')
const workspaceRef = ref(props.initial.workspace || '')
const files = computed(() => [...sandboxFiles.value])

/** 设计风格名称：从缓存列表取（列表缓存、详情不缓存），风格被删除时回退空串 */
const designStyleName = computed(
  () => useDesignStyleStore().getById(designStyleId.value)?.name ?? ''
)

const inputValue = ref('')
const mentionState = ref<{
  skills: SkillItem[]
  files: ChatFileRef[]
  tools: ToolItem[]
  canvas: CanvasNodeRef[]
  ppt: PptNodeRef[]
}>({
  skills: [],
  files: [],
  tools: [],
  canvas: [],
  ppt: []
})

type MentionState = {
  skills: SkillItem[]
  files: ChatFileRef[]
  tools: ToolItem[]
  canvas: CanvasNodeRef[]
  ppt: PptNodeRef[]
}

const extractMentions = (editor: Editor): MentionState => {
  const resultSkills: SkillItem[] = []
  const resultFiles: ChatFileRef[] = []
  const resultTools: ToolItem[] = []
  const resultCanvas: CanvasNodeRef[] = []
  const resultPpt: PptNodeRef[] = []
  editor.state.doc.descendants((node: PMNode) => {
    if (node.type.name === 'skillMention') {
      resultSkills.push({ path: node.attrs.id, name: node.attrs.label })
    } else if (node.type.name === 'fileMention') {
      const label = node.attrs.label as string
      resultFiles.push({
        path: node.attrs.id,
        name: label.split('/').pop() || label,
        relativePath: label
      })
    } else if (node.type.name === 'toolMention') {
      resultTools.push({ name: node.attrs.id, label: node.attrs.label })
    } else if (node.type.name === 'canvasMention') {
      resultCanvas.push({
        version: Number(node.attrs.version ?? 0),
        nodeId: String(node.attrs.nodeId ?? ''),
        label: String(node.attrs.label ?? '') || undefined
      })
    } else if (node.type.name === 'pptMention') {
      resultPpt.push({
        pptId: String(node.attrs.pptId ?? ''),
        slide: Number(node.attrs.slide ?? 0),
        nodeId: String(node.attrs.nodeId ?? ''),
        label: String(node.attrs.label ?? '') || undefined
      })
    }
  })
  return {
    skills: resultSkills,
    files: resultFiles,
    tools: resultTools,
    canvas: resultCanvas,
    ppt: resultPpt
  }
}

const getContents = (): UserMessageContent[] => {
  const ed = editor.value
  return ed ? serializeEditorContent(ed) : []
}

const buildUserMessage = (): ChatRequestParams | null => {
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
    agentId: agentId.value,
    workspace: workspaceRef.value,
    type: type.value,
    writingScene: writingScene.value,
    designStyleId: designStyleId.value || undefined
  }
}

const SkillMention = Mention.extend({ name: 'skillMention' }).configure({
  // 退格一次即整体删除标签，避免残留触发字符（默认 false 会把节点替换成 "/"）
  deleteTriggerWithBackspace: true,
  suggestion: buildSkillSuggestion(skills),
  renderHTML: ({ options, node }) => [
    'span',
    mergeAttributes(options.HTMLAttributes, {
      class: 'l-chat-sender__inline-tag t-tag t-tag--primary t-tag--light t-tag--medium',
      'data-type': 'skill',
      contenteditable: 'false'
    }),
    `${node.attrs.label}`
  ]
})

const FileMention = Mention.extend({ name: 'fileMention' }).configure({
  // 退格一次即整体删除标签，避免残留触发字符（默认 false 会把节点替换成 "@"）
  deleteTriggerWithBackspace: true,
  suggestion: buildFileSuggestion(files, { workspace: workspaceRef }),
  renderHTML: ({ options, node }) => [
    'span',
    mergeAttributes(options.HTMLAttributes, {
      class: 'l-chat-sender__inline-tag t-tag t-tag--success t-tag--light t-tag--medium',
      'data-type': 'file',
      contenteditable: 'false'
    }),
    `${node.attrs.label}`
  ]
})

const ToolMention = Mention.extend({ name: 'toolMention' }).configure({
  deleteTriggerWithBackspace: true,
  suggestion: buildToolSuggestion(),
  renderHTML: ({ options, node }) => [
    'span',
    mergeAttributes(options.HTMLAttributes, {
      class: 'l-chat-sender__inline-tag t-tag t-tag--warning t-tag--light t-tag--medium',
      'data-type': 'tool',
      contenteditable: 'false'
    }),
    `${node.attrs.label}`
  ]
})

/** 画布节点引用标签：双击侧边栏画布节点程序化插入（无触发字符，不挂 suggestion 插件） */
const CanvasMention = TiptapNode.create({
  name: 'canvasMention',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,
  addAttributes: () => ({
    version: { default: 0 },
    nodeId: { default: '' },
    label: { default: '' }
  }),
  parseHTML: () => [{ tag: 'span[data-type="canvas"]' }],
  renderHTML: ({ node }) => [
    'span',
    mergeAttributes({
      class: 'l-chat-sender__inline-tag t-tag t-tag--default t-tag--light t-tag--medium',
      'data-type': 'canvas',
      contenteditable: 'false'
    }),
    `画布(canvas-${node.attrs.version})节点(${node.attrs.label || node.attrs.nodeId})`
  ]
})

/** PPT 节点引用标签：侧边栏选中节点 + 「引用此节点」按钮程序化插入（无触发字符，不挂 suggestion 插件） */
const PptMention = TiptapNode.create({
  name: 'pptMention',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,
  addAttributes: () => ({
    pptId: { default: '' },
    slide: { default: 1 },
    nodeId: { default: '' },
    label: { default: '' }
  }),
  parseHTML: () => [{ tag: 'span[data-type="ppt"]' }],
  renderHTML: ({ node }) => [
    'span',
    mergeAttributes({
      class: 'l-chat-sender__inline-tag t-tag t-tag--warning t-tag--light t-tag--medium',
      'data-type': 'ppt',
      contenteditable: 'false'
    }),
    `PPT(${node.attrs.pptId})节点(${node.attrs.label || node.attrs.nodeId})`
  ]
})

// 直接读取 suggestion 插件内部的 active 状态，作为回车是否让位给选中的权威判断，
// 避免依赖易失同步的外部标志（曾导致弹层可见时回车误触发发送）。
const isSuggestionActive = (ed?: Editor | null): boolean => {
  if (!ed) return false
  return [skillMentionPluginKey, fileMentionPluginKey, toolMentionPluginKey].some(
    (key) => key.getState(ed.state)?.active
  )
}

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: false,
      bulletList: false,
      orderedList: false,
      blockquote: false,
      codeBlock: false,
      horizontalRule: false
    }),
    SkillMention,
    FileMention,
    ToolMention,
    CanvasMention,
    PptMention
  ],
  content: props.initial.input || '',
  editable: !props.loading,
  editorProps: {
    attributes: { class: 'l-chat-sender__pm' },
    handleKeyDown: (_view, event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        // 任一 suggestion 弹层激活时，交由 suggestion 插件处理选中，禁止发送消息
        if (isSuggestionActive(editor.value)) return false
        handleSend()
        return true
      }
      return false
    },
    handleDrop: (_view, event) => {
      const files = event.dataTransfer?.files
      if (!files || files.length === 0) return false
      const file = files[0]
      resolveFilePath(file).then((filePath) => {
        if (filePath) insertFileByPath(filePath)
      })
      return true
    },
    handlePaste: (_view, event) => {
      const data = event.clipboardData
      if (!data) return false

      for (let i = 0; i < data.items.length; i++) {
        if (data.items[i].type.startsWith('image/')) {
          pasteImage(data.items[i])
          event.preventDefault()
          return true
        }
      }

      if (data.files.length > 0) {
        const file = data.files[0]
        resolveFilePath(file).then((filePath) => {
          if (filePath) insertFileByPath(filePath)
        })
        event.preventDefault()
        return true
      }

      const uriList = data.getData('text/uri-list')
      if (uriList) {
        const match = uriList.match(/^file:\/\/(.+)/m)
        if (match) {
          insertFileByPath(decodeURIComponent(match[1].trim()))
          event.preventDefault()
          return true
        }
      }

      const plainText = data.getData('text/plain')
      // 复制文件后粘贴：部分平台 clipboardData 不会带上文件条目（只剩文件名纯文本），
      // 先读主进程文件剪贴板，命中则插入文件引用，否则才回退纯文本插入
      event.preventDefault()
      const insertPlainFallback = (): void => {
        if (plainText) editor.value?.chain().focus().insertContent(plainText).run()
      }
      void window.preload.inject.clipboard
        .getCopyedFiles()
        .then((copied) => {
          if (copied.length > 0) {
            for (const c of copied) insertFileByPath(c.path)
          } else {
            insertPlainFallback()
          }
        })
        .catch(insertPlainFallback)
      return true
    }
  },
  onUpdate: ({ editor: ed }) => {
    inputValue.value = ed.getText()
    mentionState.value = extractMentions(ed)
  }
})

const canSend = computed(() =>
  Boolean(
    inputValue.value.trim() ||
    mentionState.value.skills.length ||
    mentionState.value.files.length ||
    mentionState.value.tools.length ||
    mentionState.value.canvas.length
  )
)
const showPlaceholder = computed(
  () =>
    !inputValue.value &&
    !mentionState.value.skills.length &&
    !mentionState.value.files.length &&
    !mentionState.value.tools.length &&
    !mentionState.value.canvas.length
)

/** 当前上下文占上下文窗口的百分比（圆环展示） */
const tokenPercent = computed(() => {
  const usage = props.tokenUsage
  if (!usage || usage.contextWindow <= 0) return 0
  return Math.min(Math.round((usage.contextTokens / usage.contextWindow) * 100), 100)
})

const tokenPopupStyle: Record<string, string> = { padding: '4px' }

const focusInput = () => editor.value?.commands.focus()

const setText = (value: string) => editor.value?.commands.setContent(value || '')

const insertSkill = (skill: LocalSkill) => {
  editor.value
    ?.chain()
    .focus()
    .insertContent([
      { type: 'skillMention', attrs: { id: skill.path, label: skill.name } },
      { type: 'text', text: ' ' }
    ])
    .run()
}

const insertTool = (tool: ToolSuggestionItem) => {
  editor.value
    ?.chain()
    .focus()
    .insertContent([
      { type: 'toolMention', attrs: { id: tool.id, label: tool.label } },
      { type: 'text', text: ' ' }
    ])
    .run()
}

const insertFile = (file: ChatFileRef) => {
  editor.value
    ?.chain()
    .focus()
    .insertContent([
      { type: 'fileMention', attrs: { id: file.path, label: file.relativePath } },
      { type: 'text', text: ' ' }
    ])
    .run()
}

const insertFileByPath = (filePath: string) => {
  const name = filePath.split('/').pop() || filePath.split('\\').pop() || 'file'
  insertFile({ name, path: filePath, relativePath: name })
}

const resolveFilePath = async (file: File): Promise<string | null> => {
  // Electron 32+ 已移除 File.path，经 webUtils.getPathForFile 还原磁盘路径（拖入 / 粘贴的磁盘文件）
  try {
    const diskPath = window.preload.webUtils.getPathForFile(file)
    if (diskPath) return diskPath
  } catch {
    // 非磁盘 File（如剪贴板截图）会抛错，走下方案兜底
  }
  if (!props.sandboxDir) return null
  const arrayBuffer = await file.arrayBuffer()
  const tmpDir = window.preload.path.join(props.sandboxDir, 'tmp')
  if (!window.preload.fs.existsSync(tmpDir)) {
    await window.preload.fs.mkdir(tmpDir, true)
  }
  const fileName = `${Date.now()}_${file.name || 'unnamed'}`
  const filePath = window.preload.path.join(tmpDir, fileName)
  await window.preload.fs.writeBinaryFile(filePath, arrayBuffer)
  return filePath
}

const pasteImage = async (item: DataTransferItem) => {
  const file = item.getAsFile()
  if (!file) return
  const filePath = await resolveFilePath(file)
  if (filePath) insertFileByPath(filePath)
}

const handleClearMode = () => {
  mode.value = 0
}

const clear = () => {
  editor.value?.commands.clearContent(true)
  inputValue.value = ''
  mentionState.value = { skills: [], files: [], tools: [], canvas: [], ppt: [] }
}

/** 画布侧边栏双击节点后注入：在输入框插入 canvasMention 标签（LChatEngine 经 DI 桥接调用） */
const addCanvasNode = (ref: CanvasNodeRef) => {
  editor.value
    ?.chain()
    .focus()
    .insertContent([
      {
        type: 'canvasMention',
        attrs: { version: ref.version, nodeId: ref.nodeId, label: ref.label ?? '' }
      },
      { type: 'text', text: ' ' }
    ])
    .run()
}

/** PPT 侧边栏选中节点 + 「引用此节点」后注入：插入 pptMention 标签（LChatEngine 经 DI 桥接调用） */
const addPptNode = (ref: PptNodeRef) => {
  editor.value
    ?.chain()
    .focus()
    .insertContent([
      {
        type: 'pptMention',
        attrs: { pptId: ref.pptId, slide: ref.slide, nodeId: ref.nodeId, label: ref.label ?? '' }
      },
      { type: 'text', text: ' ' }
    ])
    .run()
}

const handleSend = () => {
  if (!canSend.value) return
  const message = buildUserMessage()
  if (!message) return
  emit('send', message)
  clear()
}

const handleStop = () => emit('stop')

const handleContainerDrop = async (event: DragEvent) => {
  const editorDom = editor.value?.view.dom
  if (editorDom?.contains(event.target as Node)) return
  const files = event.dataTransfer?.files
  if (!files || files.length === 0) return
  const file = files[0]
  const filePath = await resolveFilePath(file)
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
    if (init.mode !== undefined) mode.value = init.mode
    if (init.type !== undefined) type.value = init.type
    if (init.writingScene !== undefined) writingScene.value = init.writingScene
    if (init.designStyleId !== undefined) designStyleId.value = init.designStyleId
    if (init.workspace !== undefined) workspaceRef.value = init.workspace
  }
)
watch(
  () => props.loading,
  (value) => editor.value?.setEditable(!value)
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
  skills.value = await localSkillList()
  await useSettingAiStore().initPromise
})

onBeforeUnmount(() => editor.value?.destroy())

defineExpose({ addCanvasNode, addPptNode })
</script>
<style scoped lang="less">
@import 'LChatSender.less';
</style>
