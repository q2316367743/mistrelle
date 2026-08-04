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
            :project-files="projectAssetFiles"
            @add-skill="insertSkill"
            @add-tool="insertTool"
            @add-ref-file="insertFile"
          />
          <ai-workspace v-model="workspaceRef" />
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
          <t-button v-if="tokenTotal > 0" shape="square" variant="text" theme="default">
            <t-progress
              :percentage="tokenTotal"
              theme="circle"
              :size="18"
              :label="false"
              :stroke-width="2"
            />
          </t-button>
          <ai-model-select v-model="modelKey" />
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
import { mergeAttributes } from '@tiptap/core'
import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { localSkillList, type LocalSkill } from '@/modules/skill'
import { useSettingAiStore, useSettingDefaultStore } from '@/store'
import { loadChatFiles, type ChatFileRef } from '@/utils/chatSender'
import type { SkillItem, ToolItem, UserMessageContent } from '@/domain'
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
import type { ChatRequestParams, ChatType } from '@/modules/chat'
import { projectAssetContextKey } from '@/pages/project/detail/context/projectAssetContext'
import { AiChatMode } from '@/entity'
import { LockOffIcon, TaskIcon } from 'tdesign-icons-vue-next'

const props = withDefaults(
  defineProps<{
    initialInput?: string
    initialModel?: string
    loading?: boolean
    placeholder?: string
    sandboxDir?: string
    tokenTotal?: number
    initialWorkspace?: string
    initialAgentId?: string
    initialMode?: AiChatMode
    initialType?: ChatType
  }>(),
  {
    initialInput: '',
    initialModel: '',
    loading: false,
    tokenTotal: 0,
    placeholder: '描述任务，/ 调用技能，# 使用工具，@ 添加上下文',
    sandboxDir: '',
    initialWorkspace: '',
    initialMode: 0,
    initialType: 'office'
  }
)
const emit = defineEmits<{
  send: [message: ChatRequestParams]
  stop: []
}>()

const skills = ref<LocalSkill[]>([])
const sandboxFiles = ref<ChatFileRef[]>([])
const modelKey = ref(props.initialModel || useSettingDefaultStore().state.defaultAssistantModel)
const agentId = ref(props.initialAgentId || '')
const mode = ref<AiChatMode>(props.initialMode)
const type = ref<ChatType>(props.initialType)
const workspaceRef = ref(props.initialWorkspace || '')
// 新建对话页类型选择在 sender 挂载后才确定，需跟随 prop 变化（类型创建后锁定，运行期不变化）
watch(
  () => props.initialType,
  (val) => {
    type.value = val ?? 'office'
  },
  { immediate: true }
)
const projectAssetContext = inject(projectAssetContextKey, null)
const projectAssetFiles = computed(() => projectAssetContext?.files.value ?? [])
const files = computed(() => [...sandboxFiles.value, ...projectAssetFiles.value])

const inputValue = ref('')
const mentionState = ref<{ skills: SkillItem[]; files: ChatFileRef[]; tools: ToolItem[] }>({
  skills: [],
  files: [],
  tools: []
})

type MentionState = { skills: SkillItem[]; files: ChatFileRef[]; tools: ToolItem[] }

const extractMentions = (editor: Editor): MentionState => {
  const resultSkills: SkillItem[] = []
  const resultFiles: ChatFileRef[] = []
  const resultTools: ToolItem[] = []
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
    }
  })
  return { skills: resultSkills, files: resultFiles, tools: resultTools }
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
      provide
    },
    mode: mode.value,
    agentId: agentId.value,
    workspace: workspaceRef.value,
    type: type.value
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
    ToolMention
  ],
  content: props.initialInput || '',
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
      if (plainText) {
        editor.value?.chain().focus().insertContent(plainText).run()
        event.preventDefault()
        return true
      }

      return false
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
    mentionState.value.tools.length
  )
)
const showPlaceholder = computed(
  () =>
    !inputValue.value &&
    !mentionState.value.skills.length &&
    !mentionState.value.files.length &&
    !mentionState.value.tools.length
)

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
  if ('path' in file && typeof file.path === 'string' && file.path) {
    return file.path
  }
  if (!props.sandboxDir) return null
  const arrayBuffer = await file.arrayBuffer()
  const tmpDir = window.preload.path.join(props.sandboxDir, 'tmp')
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
  mentionState.value = { skills: [], files: [], tools: [] }
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

// =================================== 监听 props 初始值 ===================================

watch(
  () => props.initialInput,
  (value) => {
    if (inputValue.value !== value) setText(value)
  }
)
watch(
  () => props.initialModel,
  (value) => {
    modelKey.value = value || useSettingDefaultStore().state.defaultAssistantModel
  }
)
watch(
  () => props.initialAgentId,
  (value) => {
    agentId.value = value || ''
  }
)
watch(
  () => props.initialMode,
  (value) => {
    mode.value = value || 0
  }
)
watch(
  () => props.initialWorkspace,
  (value) => {
    workspaceRef.value = value || ''
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
  setText(props.initialInput)
  skills.value = await localSkillList()
  await useSettingAiStore().initPromise
})

onBeforeUnmount(() => editor.value?.destroy())
</script>
<style scoped lang="less">
@import 'LChatSender.less';
</style>
