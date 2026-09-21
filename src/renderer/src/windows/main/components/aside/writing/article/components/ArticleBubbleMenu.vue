<template>
  <bubble-menu
    :editor="editor"
    :should-show="shouldShow"
    :update-delay="120"
    class="bubble"
    @mousedown.prevent
  >
    <template v-for="btn in buttons" :key="btn.cmd">
      <t-tooltip :content="btn.tip" placement="top">
        <t-button
          size="small"
          variant="text"
          shape="square"
          :disabled="humanizing"
          :class="{ 'is-active': readCommandActive(state, btn.cmd) }"
          @click="applyCommand(editor, btn.cmd)"
        >
          <template #icon><component :is="btn.icon" /></template>
        </t-button>
      </t-tooltip>
      <span v-if="btn.gapAfter" class="bubble__sep" />
    </template>
    <span class="bubble__sep" />
    <!-- 选中文字去 AI 味：改写请求与对比弹窗期间锁编辑器（useSelectionHumanize 编排） -->
    <t-tooltip :content="humanizeTip" placement="top">
      <t-button
        size="small"
        variant="text"
        shape="square"
        :disabled="!canHumanize"
        :loading="humanizing"
        @click="startHumanize"
      >
        <template #icon><AiEditIcon /></template>
      </t-button>
    </t-tooltip>
  </bubble-menu>
</template>
<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, type Component } from 'vue'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import type { Editor } from '@tiptap/core'
import {
  AiEditIcon,
  CodeIcon,
  LinkIcon,
  QuoteIcon,
  TextformatBoldIcon,
  TextformatItalicIcon,
  TextformatStrikethroughIcon,
  TextformatUnderlineIcon
} from 'tdesign-icons-vue-next'
import { useAuthStore } from '@/windows/main/store/AuthStore'
import { HUMANIZE_ENABLED } from '@/windows/main/modules/ai/humanize'
import {
  applyCommand,
  isSameEditorState,
  readCommandActive,
  readEditorState,
  type ArticleEditorCommand,
  type ArticleEditorState
} from './articleEditorCommands'
import { useSelectionHumanize } from '../useSelectionHumanize'

const props = defineProps<{
  editor: Editor
  /** 流式改写等期间不显示 */
  disabled?: boolean
}>()

interface BubbleButton {
  cmd: ArticleEditorCommand
  tip: string
  icon: Component
  /** 该按钮之后插入分隔线 */
  gapAfter?: boolean
}

/** 选中文字时的常用格式（与顶部工具栏共用同一命令面，此处取高频子集） */
const buttons: BubbleButton[] = [
  { cmd: 'bold', tip: '加粗', icon: TextformatBoldIcon },
  { cmd: 'italic', tip: '斜体', icon: TextformatItalicIcon },
  { cmd: 'underline', tip: '下划线', icon: TextformatUnderlineIcon },
  { cmd: 'strike', tip: '删除线', icon: TextformatStrikethroughIcon },
  { cmd: 'code', tip: '行内代码', icon: CodeIcon },
  { cmd: 'link', tip: '链接', icon: LinkIcon, gapAfter: true },
  { cmd: 'blockquote', tip: '引用', icon: QuoteIcon }
]

/**
 * 显示时机：有非空文字选区、且未选中图片（图片走 Independent 的图片悬浮框）。
 * 选区为空（仅光标）时不弹，避免遮挡输入。
 */
const shouldShow = ({
  editor,
  from,
  to
}: {
  editor: Editor
  from: number
  to: number
}): boolean => {
  if (props.disabled) return false
  if (editor.isActive('image')) return false
  if (from === to) return false
  return editor.state.doc.textBetween(from, to, '\n').trim().length > 0
}

/** 本地快照：BubbleMenu 自身不订阅 transaction，用编辑器事件自行维护 active 态 */
const state = ref<ArticleEditorState>(readEditorState(props.editor))
let last: ArticleEditorState | null = state.value

// ─── 选中文字去 AI 味 ─────────────────────────────────────────────

const { humanizing, start: startHumanize } = useSelectionHumanize({
  editor: props.editor,
  isParentLocked: () => props.disabled === true
})

const canHumanize = computed(() => HUMANIZE_ENABLED && useAuthStore().status === 'signed-in')

const humanizeTip = computed(() => {
  if (humanizing.value) return '正在改写，请稍候…'
  if (!HUMANIZE_ENABLED) return '流式接口暂未开放，敬请期待'
  if (useAuthStore().status !== 'signed-in') return '请先登录后再使用去 AI 味'
  return '去 AI 味：改写选中文字'
})

const onTransaction = (): void => {
  const next = readEditorState(props.editor)
  if (last && isSameEditorState(last, next)) return
  last = next
  state.value = next
}

onMounted(() => props.editor.on('transaction', onTransaction))
onBeforeUnmount(() => props.editor.off('transaction', onTransaction))
</script>
<style scoped lang="less">
.bubble {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  border-radius: var(--td-radius-medium);
  border: 1px solid var(--td-border-level-1-color);
  background: var(--td-bg-color-container);
  box-shadow: var(--td-shadow-2);

  &__sep {
    width: 1px;
    height: 14px;
    margin: 0 4px;
    background: var(--td-border-level-1-color);
  }

  :deep(.t-button.is-active) {
    color: var(--td-brand-color);
    background: var(--td-brand-color-light);
  }
}
</style>
