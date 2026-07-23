<template>
  <div class="l-chat-sender">
    <div class="l-chat-sender__input" :class="{ 'is-disabled': loading }" @click="focusInput">
      <span v-if="showPlaceholder" class="l-chat-sender__placeholder">{{ placeholder }}</span>
      <EditorContent :editor="editor" class="l-chat-sender__editor" />
    </div>
    <div class="l-chat-sender__footer">
      <l-chat-attachment
        v-model:agent="agentId"
        @add-skill="insertSkill"
        @add-tool="insertTool"
        @add-file="focusInput"
      />
      <div class="flex gap-8px">
        <div class="l-chat-sender__tools">
          <t-select v-model="modelKey" :options="options" placeholder="请选择模型" />
        </div>
        <t-button v-if="loading" theme="danger" variant="outline" @click="handleStop">
          停止
        </t-button>
        <t-button v-else theme="primary" :disabled="!canSend" @click="handleSend">发送</t-button>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import type { SelectProps } from 'tdesign-vue-next'
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
  type ToolSuggestionItem
} from './mentionSuggestion'
import { serializeEditorContent } from './chatSenderContent'
import { ChatRequestParams } from '@/modules/chat'

const props = withDefaults(
  defineProps<{
    initialInput?: string
    initialModel?: string
    loading?: boolean
    placeholder?: string
    rootDir?: string
    initialAgentId?: string
  }>(),
  {
    initialInput: '',
    initialModel: '',
    loading: false,
    placeholder: '说点什么吧...'
  }
)
const emit = defineEmits<{
  send: [message: ChatRequestParams]
  stop: []
}>()

const skills = ref<LocalSkill[]>([])
const files = ref<ChatFileRef[]>([])
const modelKey = ref(props.initialModel || useSettingDefaultStore().state.defaultAssistantModel)
const agentId = ref(props.initialAgentId || '')

const inputValue = ref('')
const mentionState = ref<{ skills: SkillItem[]; files: ChatFileRef[]; tools: ToolItem[] }>({
  skills: [],
  files: [],
  tools: []
})
const suggestionOpen = ref(false)
const suggestionOptions = { onOpenChange: (open: boolean) => (suggestionOpen.value = open) }

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
      resultTools.push({ name: node.attrs.name, label: node.attrs.label })
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
    content: getContents(),
    model,
    provide,
    agentId: agentId.value || undefined
  }
}

const SkillMention = Mention.extend({ name: 'skillMention' }).configure({
  // 退格一次即整体删除标签，避免残留触发字符（默认 false 会把节点替换成 "/"）
  deleteTriggerWithBackspace: true,
  suggestion: buildSkillSuggestion(skills, suggestionOptions),
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
  suggestion: buildFileSuggestion(files, suggestionOptions),
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
  suggestion: buildToolSuggestion(suggestionOptions),
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
      // suggestion 弹层打开时，让位给选择逻辑
      if (suggestionOpen.value) return false
      if (event.key === 'Enter' && !event.shiftKey) {
        handleSend()
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

const options = computed<SelectProps['options']>(() => useSettingAiStore().options)
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
      { type: 'toolMention', attrs: { name: tool.name, label: tool.label } },
      { type: 'text', text: ' ' }
    ])
    .run()
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
  () => props.loading,
  (value) => editor.value?.setEditable(!value)
)
watch(
  () => props.rootDir,
  async (value) => {
    files.value = []
    if (value) files.value = await loadChatFiles(value)
  },
  { immediate: true }
)

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
