<template>
  <div class="group-chat-sender">
    <t-popup
      :visible="suggestions.length > 0"
      placement="top-left"
      :overlay-inner-style="popupStyle"
      :z-index="1100"
    >
      <div class="group-chat-sender__input" :class="{ 'is-disabled': loading }" @click="focusInput">
        <span v-if="showPlaceholder" class="group-chat-sender__placeholder">{{ placeholder }}</span>
        <div
          ref="editorRef"
          class="group-chat-sender__editor"
          contenteditable="plaintext-only"
          :data-disabled="loading"
          @input="handleInput"
          @keydown="handleEditorKeydown"
          @paste="handlePaste"
        ></div>
      </div>
      <template #content>
        <div class="group-chat-sender__suggestions">
          <div
            v-for="(item, index) in suggestions"
            :key="item.key"
            class="group-chat-sender__suggestion"
            :class="{ 'is-active': index === suggestionIndex }"
            @mousedown.prevent="selectSuggestion(item)"
            @mouseenter="suggestionIndex = index"
          >
            <span class="group-chat-sender__suggestion-title">{{ item.title }}</span>
            <span class="group-chat-sender__suggestion-desc">{{ item.description }}</span>
          </div>
        </div>
      </template>
    </t-popup>

    <div class="group-chat-sender__footer">
      <div class="group-chat-sender__hint">
        <span class="group-chat-sender__hint-muted">输入 @ 选择成员，仅被 @ 的成员会回复</span>
      </div>
      <t-button v-if="loading" theme="danger" variant="outline" @click="emit('stop')">停止</t-button>
      <t-button v-else theme="primary" :disabled="!canSend" @click="handleSend">发送</t-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch, nextTick } from 'vue'
import { localSkillList, type LocalSkill } from '@/modules/skill'
import { useChatSender, type ChatSenderSegment } from '@/hooks'
import { matchKeyword, formatSkillDescription, type ChatFileRef } from '@/utils/chatSender'
import type { AiAgent } from '@/entity/ai'
import { useAiAgentStore } from '@/store'

interface RoleMention {
  id: string
  name: string
}
type SkillSuggestion = { key: string; title: string; description: string; token: string; type: 'skill'; data: LocalSkill }
type RoleSuggestion = { key: string; title: string; description: string; token: string; type: 'role'; data: RoleMention }
type Suggestion = SkillSuggestion | RoleSuggestion

const props = withDefaults(
  defineProps<{
    roles: Array<string>
    loading?: boolean
    placeholder?: string
  }>(),
  { loading: false, placeholder: '说点什么，输入 @ 选择成员…' }
)

const emit = defineEmits<{
  send: [payload: { segments: ChatSenderSegment[] }]
  stop: []
}>()

const skills = ref<LocalSkill[]>([])
const files = ref<ChatFileRef[]>([])
const aiAgentStore = useAiAgentStore()
const roleMentions = computed<RoleMention[]>(() => {
  const agents = aiAgentStore.state
  return props.roles
    .map((id) => agents.find((r) => r.id === id))
    .filter((r): r is AiAgent => !!r)
    .map((r) => ({ id: r.id, name: r.name }))
})

const { editorRef, inputValue, selectedSkills, selectedRoles, segments, setText, insertTag, clear, focus: focusInput, handleInput, handleKeydown, handlePaste } =
  useChatSender({
    skills,
    files,
    roles: roleMentions,
    loading: computed(() => props.loading),
    onInput: () => undefined,
    onSend: () => handleSend()
  })

const suggestionIndex = ref(0)
const popupStyle: Record<string, string> = { width: '300px', whiteSpace: 'normal' }

const canSend = computed(() => Boolean(inputValue.value.trim()))
const showPlaceholder = computed(() => !inputValue.value.trim() && segments.value.length === 0)

const activeCommand = computed(() => inputValue.value.match(/(?:^|\s)([\/@])([^\s]*)$/))
const suggestions = computed<Suggestion[]>(() => {
  const match = activeCommand.value
  if (!match) return []
  const keyword = match[2].toLowerCase()
  if (match[1] === '/') {
    return skills.value
      .filter((item) => matchKeyword(`${item.name} ${item.dirName} ${formatSkillDescription(item)}`, keyword))
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
  return roleMentions.value
    .filter((item) => matchKeyword(item.name, keyword))
    .slice(0, 8)
    .map((item) => ({
      key: `role:${item.id}`,
      title: `@${item.name}`,
      description: '提及该成员，使其针对本条消息回复',
      token: `@${item.name}`,
      type: 'role',
      data: item
    }))
})

const selectSuggestion = (item: Suggestion) => {
  const match = activeCommand.value
  if (!match) return
  if (item.type === 'skill') {
    if (selectedSkills.value.some((s) => s.path === item.data.path)) return
    insertTag('skill', item.data, match[0])
  } else {
    // 允许重复 @ 同一成员
    insertTag('role', item.data, match[0])
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
      handleKeydown(event)
    }
  } else {
    handleKeydown(event)
  }
}

const handleSend = () => {
  if (!canSend.value) return
  emit('send', { segments: segments.value })
  clear()
}

watch(suggestions, (list) => {
  suggestionIndex.value = list.length ? 0 : -1
})

watch(
  () => props.loading,
  (value) => {
    if (!value) clear()
  }
)

onMounted(async () => {
  skills.value = await localSkillList()
})
</script>

<style scoped lang="less">
.group-chat-sender {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--td-comp-margin-s);
  padding: var(--td-comp-paddingTB-m) var(--td-comp-paddingLR-l);
  border: 1px solid var(--fluent-card-border);
  border-radius: var(--fluent-radius-card);
  background: var(--fluent-card-bg);
  box-shadow: var(--fluent-card-shadow);
}

.group-chat-sender__suggestions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 240px;
  overflow: auto;
}

.group-chat-sender__suggestion {
  display: flex;
  flex-direction: column;
  padding: 4px 8px;
  border-radius: var(--td-radius-medium);
  cursor: pointer;

  &.is-active {
    background: var(--td-bg-color-container-active);
  }
}

.group-chat-sender__suggestion-title {
  color: var(--td-text-color-primary);
  font: var(--td-font-body-medium);
}

.group-chat-sender__suggestion-desc {
  color: var(--td-text-color-secondary);
  font: var(--td-font-body-small);
}

.group-chat-sender__input {
  position: relative;
  min-height: 64px;
  cursor: text;
}

.group-chat-sender__placeholder {
  position: absolute;
  top: 0;
  left: 0;
  color: var(--td-text-color-placeholder);
  font: var(--td-font-body-medium);
  line-height: 24px;
  pointer-events: none;
}

.group-chat-sender__editor {
  min-height: 64px;
  outline: none;
  font: var(--td-font-body-medium);
  color: var(--td-text-color-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.group-chat-sender__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.group-chat-sender__hint {
  color: var(--td-brand-color);
  font: var(--td-font-body-small);
}

.group-chat-sender__hint-muted {
  color: var(--td-text-color-placeholder);
}
</style>
