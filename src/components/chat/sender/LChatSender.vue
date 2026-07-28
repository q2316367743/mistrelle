<template>
  <div class="l-chat-sender-container">
    <div class="l-chat-sender">
      <div class="l-chat-sender__input" :class="{ 'is-disabled': loading }" @click="focusInput">
        <span v-if="showPlaceholder" class="l-chat-sender__placeholder">{{ placeholder }}</span>
        <EditorContent :editor="editor" class="l-chat-sender__editor" />
      </div>
      <div class="l-chat-sender__footer">
        <div class="l-chat-sender__footer-left">
          <l-chat-attachment
            v-model:agent="agentId"
            :sandbox-dir="sandboxDir"
            :workspace-dir="workspaceRef"
            :project-files="projectAssetFiles"
            @add-skill="insertSkill"
            @add-tool="insertTool"
            @add-ref-file="insertFile"
          />
          <ai-workspace v-model="workspaceRef" />
        </div>
        <div class="flex gap-8px">
          <div class="l-chat-sender__tools">
            <t-button shape="square" variant="text" theme="default">
              <t-progress
                :percentage="18"
                theme="circle"
                :size="18"
                :label="false"
                :stroke-width="2"
              />
            </t-button>
            <ai-model-select v-model="modelKey" />
          </div>
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
import type { ChatRequestParams } from '@/modules/chat'
import { projectAssetContextKey } from '@/pages/project/detail/context/projectAssetContext'

const props = withDefaults(
  defineProps<{
    initialInput?: string
    initialModel?: string
    loading?: boolean
    placeholder?: string
    sandboxDir?: string
    initialWorkspace?: string
    initialAgentId?: string
  }>(),
  {
    initialInput: '',
    initialModel: '',
    loading: false,
    placeholder: '描述任务，/ 调用技能，# 使用工具，@ 添加上下文',
    sandboxDir: '',
    initialWorkspace: ''
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
const workspaceRef = ref(props.initialWorkspace || '')
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
    agentId: agentId.value,
    workspace: workspaceRef.value
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
  suggestion: buildFileSuggestion(files),
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
      const filePath = 'path' in file && typeof file.path === 'string' ? file.path : undefined
      if (!filePath) return false
      setTimeout(() => insertFileByPath(filePath))
      return true
    },
    handlePaste: (_view, event) => {
      const items = event.clipboardData?.items
      if (!items) return false
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.startsWith('image/')) {
          pasteImage(item)
          return true
        }
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

const pasteImage = async (item: DataTransferItem) => {
  const file = item.getAsFile()
  if (!file || !props.sandboxDir) return
  const arrayBuffer = await file.arrayBuffer()
  const tmpDir = window.preload.path.join(props.sandboxDir, 'tmp')
  const ext = file.type.split('/')[1] || 'png'
  const fileName = `paste_${Date.now()}.${ext}`
  const filePath = window.preload.path.join(tmpDir, fileName)
  await window.preload.fs.writeBinaryFile(filePath, arrayBuffer)
  insertFile({ name: fileName, path: filePath, relativePath: fileName })
}

const selectWorkspace = () => {
  const paths = window.preload.inject.dialog.open({ properties: ['openDirectory'] })
  if (!paths || paths.length === 0) return
  workspaceRef.value = paths[0]
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

onMounted(async () => {
  setText(props.initialInput)
  skills.value = await localSkillList()
  await useSettingAiStore().initPromise
})

onBeforeUnmount(() => editor.value?.destroy())

// 直接读取 suggestion 插件内部的 active 状态，作为回车是否让位给选中的权威判断，
// 避免依赖易失同步的外部标志（曾导致弹层可见时回车误触发发送）。
const isSuggestionActive = (ed?: Editor | null): boolean => {
  if (!ed) return false
  return [skillMentionPluginKey, fileMentionPluginKey, toolMentionPluginKey].some(
    (key) => key.getState(ed.state)?.active
  )
}
</script>
<style scoped lang="less">
@import 'LChatSender.less';
</style>
