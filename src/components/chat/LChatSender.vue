<template>
  <div class="l-chat-sender">
    <div v-if="suggestions.length" class="l-chat-sender__suggestions">
      <t-popup
        v-for="(item, index) in suggestions"
        :key="item.key"
        class="l-chat-sender__suggestion-popup"
        :content="item.description"
        placement="right"
        :overlay-inner-style="popupStyle"
        :disabled="!item.description"
      >
        <div
          class="l-chat-sender__suggestion"
          :class="{ 'is-active': index === suggestionIndex }"
          @mousedown.prevent="selectSuggestion(item)"
          @mouseenter="suggestionIndex = index"
        >
          <span class="l-chat-sender__suggestion-title">{{ item.title }}</span>
          <span class="l-chat-sender__suggestion-desc">{{ item.description }}</span>
        </div>
      </t-popup>
    </div>
    <div class="l-chat-sender__input" :class="{ 'is-disabled': loading }" @click="focusInput">
      <span v-if="showPlaceholder" class="l-chat-sender__placeholder">{{ placeholder }}</span>
      <div
        ref="editorRef"
        class="l-chat-sender__editor"
        contenteditable="plaintext-only"
        :data-disabled="loading"
        @input="handleInput"
        @keydown="handleEditorKeydown"
        @paste="handlePaste"
      ></div>
    </div>
    <div class="l-chat-sender__footer">
      <div class="l-chat-sender__tools">
        <t-select v-model="model" :options="options" placeholder="请选择模型" />
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
import { localSkillList, type LocalSkill } from '@/modules/skill'
import { useSettingAiStore, useSettingDefaultStore } from '@/store'
import { useBoolState, useChatSender } from '@/hooks'
import {
  loadChatFiles,
  formatSkillDescription,
  matchKeyword,
  type ChatFileRef
} from '@/utils/chatSender'

type SkillSuggestion = {
  key: string
  title: string
  description: string
  token: string
  type: 'skill'
  data: LocalSkill
}
type FileSuggestion = Omit<SkillSuggestion, 'type' | 'data'> & { type: 'file'; data: ChatFileRef }
type Suggestion = SkillSuggestion | FileSuggestion

const props = withDefaults(
  defineProps<{
    input?: string
    model?: string
    think?: boolean
    loading?: boolean
    placeholder?: string
    rootDir?: string
  }>(),
  { input: '', model: '', think: true, loading: false, placeholder: '说点什么吧...' }
)
const emit = defineEmits<{
  'update:input': [value: string]
  'update:model': [value: string]
  'update:think': [value: boolean]
  send: []
  stop: []
}>()

const skills = ref<LocalSkill[]>([])
const files = ref<ChatFileRef[]>([])
const model = ref(props.model || useSettingDefaultStore().state.defaultAssistantModel)
const [thinkValue, toggleThink] = useBoolState(props.think)

const {
  editorRef,
  inputValue,
  selectedSkills,
  selectedFiles,
  setText,
  insertTag,
  clear,
  clearTags,
  focus: focusInput,
  handleInput,
  handleKeydown: composableHandleKeydown,
  handlePaste
} = useChatSender({
  skills,
  files,
  loading: toRef(props, 'loading'),
  onInput: (value) => emit('update:input', value),
  onSend: () => emit('send')
})

const suggestionIndex = ref(0)

const popupStyle: Record<string, string> = { width: '300px', whiteSpace: 'normal' }

const options = computed<SelectProps['options']>(() => useSettingAiStore().options)
const canSend = computed(() =>
  Boolean(inputValue.value.trim() || selectedSkills.value.length || selectedFiles.value.length)
)
const showPlaceholder = computed(
  () => !inputValue.value && !selectedSkills.value.length && !selectedFiles.value.length
)
const activeCommand = computed(() => inputValue.value.match(/(?:^|\s)([\/@])([^\s]*)$/))
const suggestions = computed<Suggestion[]>(() => {
  const match = activeCommand.value
  if (!match) return []
  const keyword = match[2].toLowerCase()
  if (match[1] === '/') {
    return skills.value
      .filter((item) =>
        matchKeyword(`${item.name} ${item.dirName} ${formatSkillDescription(item)}`, keyword)
      )
      .slice(0, 8)
      .map((item) => ({
        key: `skill:${item.path}`,
        title: item.name,
        description: formatSkillDescription(item) || `${item.agentName}/${item.dirName}`,
        token: `/${item.name}`,
        type: 'skill',
        data: item
      }))
  }
  if (!props.rootDir) return []
  return files.value
    .filter((item) => matchKeyword(item.relativePath, keyword))
    .slice(0, 8)
    .map((item) => ({
      key: `file:${item.path}`,
      title: item.relativePath,
      description: item.path,
      token: `@${item.relativePath}`,
      type: 'file',
      data: item
    }))
})

const selectSuggestion = (item: Suggestion) => {
  const match = activeCommand.value
  if (!match) return
  if (item.type === 'skill') {
    if (selectedSkills.value.some((current) => current.path === item.data.path)) return
    insertTag('skill', item.data, match[0])
  } else {
    if (selectedFiles.value.some((current) => current.path === item.data.path)) return
    insertTag('file', item.data, match[0])
  }
  nextTick(focusInput)
}

const handleEditorKeydown = (event: KeyboardEvent) => {
  const list = suggestions.value
  if (list.length) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      suggestionIndex.value = (suggestionIndex.value + 1) % list.length
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      suggestionIndex.value = (suggestionIndex.value - 1 + list.length) % list.length
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      selectSuggestion(list[suggestionIndex.value])
    } else if (event.key === 'Backspace') {
      composableHandleKeydown(event)
    }
  } else {
    composableHandleKeydown(event)
  }
}

const handleSend = () => {
  if (canSend.value) emit('send')
}

const handleStop = () => emit('stop')

watch(suggestions, (list) => {
  suggestionIndex.value = list.length ? 0 : -1
})

watch(model, (value) => emit('update:model', value))
watch(thinkValue, (value) => emit('update:think', value))
watch(
  () => props.input,
  (value) => {
    if (inputValue.value !== value) setText(value)
  }
)
watch(
  () => props.model,
  (value) => {
    model.value = value
  }
)
watch(
  () => props.think,
  (value) => {
    thinkValue.value = value
  }
)
watch(
  () => props.rootDir,
  async (value) => {
    files.value = []
    clearTags('file')
    if (value) files.value = await loadChatFiles(value)
  },
  { immediate: true }
)

onMounted(async () => {
  setText(props.input)
  skills.value = await localSkillList()
})

defineExpose({
  getSelectedSkills: () => selectedSkills.value,
  getSelectedFiles: () => selectedFiles.value,
  clearRefs: () => clear()
})
</script>
<style scoped lang="less" src="./LChatSender.less"></style>
