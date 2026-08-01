<template>
  <div class="chat-assistant">
    <template
      v-for="(contentItem, contentIndex) in message.content"
      :key="contentItem.id || contentIndex"
    >
      <button
        v-if="isContinueHint(contentItem)"
        class="continue-hint"
        @click="emit('continue', message.id)"
      >
        <RefreshIcon class="continue-hint__icon" />
        <span class="continue-hint__text">已到达本轮连续工具调用上限，点击继续推进</span>
      </button>
      <ChatContent
        v-else-if="contentItem.type === 'text' || contentItem.type === 'markdown'"
        :content="contentItem.data"
      />
      <r-chat-think
        v-else-if="contentItem.type === 'thinking'"
        :content="contentItem"
        :index="contentIndex"
      />
      <r-chat-tool v-else-if="contentItem.type === 'toolcall'" :content="contentItem" />
    </template>
    <FileProductList :message="message" />

    <div v-if="isLoading" class="loading-indicator">
      <span class="loading-dots">{{ loadingText }}</span>
    </div>

    <div v-else-if="isCompleted" class="footer-info">
      <t-tag variant="light" size="small">{{ message.model }}</t-tag>
      <span class="footer-item">{{ durationText }}</span>
      <span class="footer-item">~{{ charCount }} 字符</span>
    </div>

    <RChatActionbar
      v-if="!isLoading"
      role="assistant"
      class="mt-8px"
      :comment="message.comment"
      :content="getAssistantText(message)"
      @comment-change="handleCommentChange(message, $event)"
    />
  </div>
</template>
<script lang="ts" setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import type { PropType } from 'vue'
import { AIMessage, type AIMessageContent, type ChatComment, ChatStatus } from '@/domain'
import { RefreshIcon } from 'tdesign-icons-vue-next'
import RChatTool from '@/components/chat/chat-assistant/RChatTool.vue'
import FileProductList from '@/components/chat/chat-assistant/FileProductList.vue'
import { ChatContent } from '@tdesign-vue-next/chat'
import RChatActionbar from '@/components/chat/RChatActionbar.vue'
import { LOADING_TEXTS } from '@/global/Constant'

const props = defineProps({
  message: {
    type: Object as PropType<AIMessage>,
    required: true
  },
  status: {
    type: String as PropType<ChatStatus>,
    required: true
  }
})

const emit = defineEmits(['change', 'continue'])

const isContinueHint = (item: AIMessageContent): boolean =>
  item.type === 'text' && item.ext?.continueHint === true

const isLoading = computed(
  () =>
    (props.message.status === 'pending' || props.message.status === 'streaming') &&
    (props.status === 'pending' || props.status === 'streaming')
)

const isCompleted = computed(
  () => props.message.status === 'complete' || props.message.status === 'stop'
)

const durationText = computed(() => {
  if (!props.message.finishedAt || !props.message.datetime) return ''
  const start = new Date(props.message.datetime).getTime()
  if (isNaN(start)) return ''
  const diff = props.message.finishedAt - start
  if (diff < 1000) return '< 1 秒'
  if (diff < 60000) return `${Math.round(diff / 1000)} 秒`
  const m = Math.floor(diff / 60000)
  const s = Math.round((diff % 60000) / 1000)
  return `${m} 分 ${s} 秒`
})

const charCount = computed(() => {
  if (!props.message.content) return 0
  return props.message.content.reduce((sum, item) => {
    if (item.type === 'text' || item.type === 'markdown') {
      return sum + (item.data as string).length
    }
    if (item.type === 'thinking') {
      return sum + ((item.data as { text?: string }).text ?? '').length
    }
    return sum
  }, 0)
})

const loadingIndex = ref(0)
let loadingTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  loadingTimer = setInterval(() => {
    loadingIndex.value = (loadingIndex.value + 1) % LOADING_TEXTS.length
  }, 2500)
})
onUnmounted(() => {
  clearInterval(loadingTimer)
})

const loadingText = computed(() => LOADING_TEXTS[loadingIndex.value])

const getAssistantText = (message: AIMessage) => {
  return (
    message.content?.find((item) => item.type === 'markdown' || item.type === 'text')?.data ?? ''
  )
}

const handleCommentChange = (message: AIMessage, comment: ChatComment) => {
  message.comment = comment
  emit('change')
}
</script>
<style scoped lang="less">
.continue-hint {
  display: inline-flex;
  align-items: center;
  gap: var(--td-comp-margin-s);
  margin: var(--td-comp-margin-xs) 0;
  padding: var(--td-comp-paddingTB-xs) var(--td-comp-paddingLR-s);
  border: 1px dashed var(--td-brand-color);
  border-radius: var(--td-radius-small);
  background: var(--td-brand-color-light);
  color: var(--td-brand-color);
  font: var(--td-font-body-small);
  cursor: pointer;
  transition:
    background-color 100ms ease-out,
    border-color 100ms ease-out;

  &:hover {
    background: var(--td-brand-color-light-hover, var(--td-brand-color-light));
    border-color: var(--td-brand-color-2, var(--td-brand-color));
  }

  &__icon {
    flex-shrink: 0;
    font-size: var(--td-font-size-body-large);
  }

  &__text {
    white-space: nowrap;
  }
}

.loading-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  &::after {
    content: '';
    display: inline-block;
    width: 6px;
    animation: pulse-dot 1.4s infinite steps(1);
  }
}

.footer-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  color: var(--td-text-color-placeholder);
  font-size: 12px;
}

.footer-item {
  white-space: nowrap;
}

@keyframes pulse-dot {
  0%,
  100% {
    box-shadow: 6px 0 currentColor;
  }
  33% {
    box-shadow:
      6px 0 transparent,
      12px 0 currentColor;
  }
  66% {
    box-shadow:
      6px 0 transparent,
      12px 0 transparent,
      18px 0 currentColor;
  }
}
</style>
