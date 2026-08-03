<template>
  <div class="chat-assistant">
    <!-- 消息完成后默认折叠过程：仅显示折叠条 + 最终回复，节省空间并减少渲染节点。
         无最终回复时（如整轮只有 toolcall / 被中止）不折叠也不显示按钮 -->
    <button
      v-if="canCollapse"
      class="process-collapse"
      @click="processExpanded = !processExpanded"
    >
      <ChevronDownIcon v-if="!processExpanded" class="process-collapse__icon" />
      <ChevronRightIcon v-else class="process-collapse__icon" />
      <span class="process-collapse__text">
        {{ processExpanded ? '收起执行过程' : `已折叠执行过程（${processCount} 步），点击展开` }}
      </span>
    </button>
    <template
      v-for="(contentItem, contentIndex) in visibleContents"
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
        :active="contentIndex === activeThinkingIndex"
      />
      <r-chat-tool
        v-else-if="contentItem.type === 'toolcall'"
        :content="contentItem"
        @view-sub-agent="handleViewSubAgent"
      />
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
import { ChevronDownIcon, ChevronRightIcon, RefreshIcon } from 'tdesign-icons-vue-next'
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

const emit = defineEmits(['change', 'continue', 'view-sub-agent'])

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

// ─── 完成后过程折叠 ────────────────────────────────────────────────

/** 最终回复：content 中最后一条非 continueHint 的 text/markdown（agent 循环最后一步的输出） */
const finalContent = computed<AIMessageContent | undefined>(() => {
  const contents = props.message.content ?? []
  for (let i = contents.length - 1; i >= 0; i--) {
    const item = contents[i]
    if ((item.type === 'text' || item.type === 'markdown') && !isContinueHint(item)) {
      return item
    }
  }
  return undefined
})

/** 是否存在可折叠的过程内容（thinking / toolcall / 中间文本等，排除最终回复与 continueHint 操作按钮） */
const hasProcess = computed(() => {
  const contents = props.message.content ?? []
  return contents.some((item) => item !== finalContent.value && !isContinueHint(item))
})

/** 是否可折叠：完成 + 有最终回复（折叠后的展示目标）+ 有过程，三者缺一不可。
 *  无最终回复时（整轮只有 toolcall / 被中止）不折叠也不显示按钮，避免"声称已折叠实际全量"的误导 */
const canCollapse = computed(() => isCompleted.value && !!finalContent.value && hasProcess.value)

/** 过程步数：thinking + toolcall 数量（不含最终回复文本） */
const processCount = computed(() => {
  const contents = props.message.content ?? []
  return contents.filter(
    (item) => item !== finalContent.value && (item.type === 'thinking' || item.type === 'toolcall')
  ).length
})

/** 过程是否展开（默认折叠） */
const processExpanded = ref(false)

/**
 * 实际渲染的内容列表：
 * - 进行中（streaming/pending）：全量平铺，实时展示过程
 * - 完成且折叠：保留最终回复 + 全部 continueHint（继续按钮是操作入口，必须始终可见，不能被折叠）
 * - 完成且展开 / 无过程可折叠：全量
 */
const visibleContents = computed(() => {
  const contents = props.message.content ?? []
  if (!isCompleted.value) return contents
  if (processExpanded.value) return contents
  if (!finalContent.value) return contents
  // 折叠：仅保留最终回复与继续按钮（continueHint），其余过程（thinking/toolcall/中间文本）隐藏
  return contents.filter((item) => item === finalContent.value || isContinueHint(item))
})

/**
 * 正在思考中的 thinking 块索引（content 数组中最后一个 status 未完成的 thinking）。
 * 仅该块默认展开（RChatThink 通过 active prop 决定初始折叠态），思考完成后其 status
 * 置为 complete，active 自然失效并由子组件自动折叠。
 */
const activeThinkingIndex = computed(() => {
  const contents = props.message.content ?? []
  for (let i = contents.length - 1; i >= 0; i--) {
    const item = contents[i]
    if (item.type === 'thinking' && item.status !== 'complete') return i
  }
  return -1
})

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

const handleViewSubAgent = (subAgentId: string) => {
  emit('view-sub-agent', subAgentId)
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

.process-collapse {
  display: inline-flex;
  align-items: center;
  gap: var(--td-comp-margin-xs);
  margin: var(--td-comp-margin-xs) 0;
  padding: var(--td-comp-paddingTB-xxs) var(--td-comp-paddingLR-s);
  border: 1px solid var(--td-component-border);
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-component);
  color: var(--td-text-color-secondary);
  font: var(--td-font-body-small);
  cursor: pointer;
  user-select: none;
  transition:
    background-color 120ms ease-out,
    border-color 120ms ease-out,
    color 120ms ease-out;

  &:hover {
    border-color: var(--td-brand-color);
    color: var(--td-brand-color);
    background: var(--td-brand-color-light);
  }

  &__icon {
    flex-shrink: 0;
    font-size: var(--td-font-size-body-medium);
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
