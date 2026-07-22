<template>
  <div class="l-chat-sender">
    <div class="l-chat-sender__input" :class="{ 'is-disabled': loading }" @click="focusInput">
      <span v-if="showPlaceholder" class="l-chat-sender__placeholder">{{ placeholder }}</span>
      <EditorContent :editor="editor" class="l-chat-sender__editor" />
    </div>
    <div class="l-chat-sender__footer">
      <div class="l-chat-sender__tools">
        <t-select v-model="modelKey" :options="options" placeholder="请选择模型" />
        <t-button
          :variant="thinkValue ? 'base' : 'outline'"
          shape="round"
          :theme="thinkValue ? 'primary' : 'default'"
          @click="toggleThink()"
          class="shrink-0"
        >
          <template #icon><SystemSumIcon /></template>
          深度思考
        </t-button>
      </div>
      <t-button v-if="loading" theme="danger" variant="outline" @click="handleStop">停止</t-button>
      <t-button v-else theme="primary" :disabled="!canSend" @click="handleSend">发送</t-button>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { SystemSumIcon } from 'tdesign-icons-vue-next'
import type { SelectProps } from 'tdesign-vue-next'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Mention from '@tiptap/extension-mention'
import { mergeAttributes } from '@tiptap/core'
import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { nanoid } from 'nanoid'
import { localSkillList, type LocalSkill } from '@/modules/skill'
import { useSettingAiStore, useSettingDefaultStore } from '@/store'
import { useBoolState } from '@/hooks'
import { MessageUtil } from '@/utils/modal'
import { toDateString } from '@/utils/lang'
import { loadChatFiles, type ChatFileRef } from '@/utils/chatSender'
import type { SkillItem, UserMessage, UserMessageContent } from '@/domain'
import {
  buildFileSuggestion,
  buildSkillSuggestion,
  suggestionOpen
} from './mentionSuggestion'
import { serializeEditorContent } from './chatSenderContent'

const props = withDefaults(
  defineProps<{
    initialInput?: string
    initialModel?: string
    initialThink?: boolean
    loading?: boolean
    placeholder?: string
    rootDir?: string
  }>(),
  { initialInput: '', initialModel: '', initialThink: true, loading: false, placeholder: '说点什么吧...' }
)
const emit = defineEmits<{
  send: [message: UserMessage]
  stop: []
}>()

const skills = ref<LocalSkill[]>([])
const files = ref<ChatFileRef[]>([])
const modelKey = ref(props.initialModel || useSettingDefaultStore().state.defaultAssistantModel)
const [thinkValue, toggleThink] = useBoolState(props.initialThink)

const inputValue = ref('')
const mentionState = ref<{ skills: SkillItem[]; files: ChatFileRef[] }>({ skills: [], files: [] })

// 从编辑器文档中提取结构化引用（不再解析文本）
const extractMentions = (editor: Editor): { skills: SkillItem[]; files: ChatFileRef[] } => {
  const resultSkills: SkillItem[] = []
  const resultFiles: ChatFileRef[] = []
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
    }
  })
  return { skills: resultSkills, files: resultFiles }
}

/**
 * 直接输出结构化的 UserMessageContent[]（文本 + SkillContent + AttachmentContent），
 * skill/file 仅存引用（path+name/url）。
 */
const getContents = (): UserMessageContent[] => {
  const ed = editor.value
  return ed ? serializeEditorContent(ed) : []
}

/**
 * 把当前编辑器状态组装为完整的 UserMessage。
 * 模型选项在组件内部解析，保证 send 事件流出的是可直接落盘/请求的完整数据。
 */
const buildUserMessage = (): UserMessage | null => {
  const option = useSettingAiStore().optionMap.get(modelKey.value)
  if (!option) {
    MessageUtil.error('请选择模型')
    return null
  }
  return {
    id: nanoid(),
    role: 'user',
    content: getContents(),
    model: option.identifier,
    provide: option.provideId,
    thinking: thinkValue.value ? 'enabled' : 'disabled',
    datetime: toDateString(null)
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
    FileMention
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
  Boolean(inputValue.value.trim() || mentionState.value.skills.length || mentionState.value.files.length)
)
const showPlaceholder = computed(
  () => !inputValue.value && !mentionState.value.skills.length && !mentionState.value.files.length
)

const focusInput = () => editor.value?.commands.focus()

const setText = (value: string) => editor.value?.commands.setContent(value || '')

const clear = () => {
  editor.value?.commands.clearContent(true)
  inputValue.value = ''
  mentionState.value = { skills: [], files: [] }
}

// 发送：产出完整 UserMessage 向外 emit，并自行清空自身输入（高内聚）
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
  () => props.initialThink,
  (value) => {
    thinkValue.value = value ?? true
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
<style scoped lang="less" src="./LChatSender.less"></style>
