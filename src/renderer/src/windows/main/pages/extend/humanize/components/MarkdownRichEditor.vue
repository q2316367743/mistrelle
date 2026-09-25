<template>
  <div class="md-rich">
    <div v-if="editable" class="md-rich__toolbar">
      <t-select
        class="md-rich__block"
        size="small"
        :value="state.blockType"
        :options="ArticleBlockTypeOptions"
        @change="handleBlockType"
      />
      <span class="md-rich__sep" />
      <t-tooltip v-for="btn in buttons" :key="btn.cmd" :content="btn.tip">
        <t-button
          size="small"
          variant="text"
          shape="square"
          :class="{ 'is-active': readCommandActive(state, btn.cmd) }"
          :disabled="!readCommandEnabled(state, btn.cmd)"
          @click="handleCommand(btn.cmd)"
        >
          <template #icon><component :is="btn.icon" /></template>
        </t-button>
      </t-tooltip>
    </div>
    <div class="md-rich__body" @click="focusEditor">
      <editor-content v-if="editor" :editor="editor" />
    </div>
  </div>
</template>
<script lang="ts" setup>
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { TableKit } from '@tiptap/extension-table'
import {
  ArticleBlockTypeOptions,
  EMPTY_EDITOR_STATE,
  applyBlockType,
  applyCommand,
  isSameEditorState,
  readCommandActive,
  readCommandEnabled,
  readEditorState,
  type ArticleEditorCommand,
  type ArticleEditorState
} from '@/windows/main/components/aside/writing/article/components/articleEditorCommands'
import { ARTICLE_FORMAT_BUTTONS } from '@/windows/main/components/aside/writing/article/components/articleFormatButtons'

/**
 * Markdown 富文本编辑器（独立页面用）：TipTap + markdown 双向（getMarkdown / setContent），
 * 工具栏复用文章编辑器的命令面与按钮元数据（纯函数层），但不带文章场景的版本 / 插图 / 悬浮框。
 */
const props = defineProps<{
  /** 正文（markdown；外部变化时按差异同步进编辑器） */
  content: string
  /** 是否可编辑（默认 true；如流式改写期间由父级传 false 锁定） */
  editable?: boolean
}>()

const emit = defineEmits<{
  (e: 'change', value: string): void
}>()

/** 内联按钮（顺序取自元数据表的优先级顺序） */
const TOOLBAR_CMDS: ArticleEditorCommand[] = [
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'link',
  'bulletList',
  'orderedList',
  'blockquote',
  'codeBlock',
  'table',
  'horizontalRule',
  'undo',
  'redo',
  'clearFormat'
]

const buttons = ARTICLE_FORMAT_BUTTONS.filter((btn) => TOOLBAR_CMDS.includes(btn.cmd))

const state = ref<ArticleEditorState>(EMPTY_EDITOR_STATE)
/** 上次上报的快照（浅比较用）；须在 useEditor 之前声明——onCreate 会在 useEditor 内同步触发 */
let lastState: ArticleEditorState | null = null

const handleCommand = (cmd: ArticleEditorCommand): void => {
  const ed = editor.value
  if (ed) applyCommand(ed, cmd)
}

const handleBlockType = (value: unknown): void => {
  const ed = editor.value
  // 下拉值来自 ArticleBlockTypeOptions，据此收窄（避免裸 as）
  const type = ArticleBlockTypeOptions.find((item) => item.value === value)?.value
  if (ed && type) applyBlockType(ed.chain().focus(), type).run()
}

/** 点击正文留白处也把光标落回编辑器 */
const focusEditor = (): void => {
  editor.value?.chain().focus().run()
}

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      // 编辑器内点击链接只落光标、不跳转
      link: { openOnClick: false }
    }),
    Markdown,
    TableKit
  ],
  content: props.content,
  contentType: 'markdown',
  editable: props.editable !== false,
  editorProps: { attributes: { class: 'md-rich__pm' } },
  onUpdate: ({ editor: ed }) => emit('change', ed.getMarkdown()),
  // 每次 transaction 都重算快照，仅在确有变化时上报，避免每敲一键就重渲染工具栏
  onTransaction: ({ editor: ed }) => {
    const next = readEditorState(ed)
    if (lastState && isSameEditorState(lastState, next)) return
    lastState = next
    state.value = next
  },
  onCreate: ({ editor: ed }) => {
    lastState = readEditorState(ed)
    state.value = lastState
  }
})

watch(
  () => props.editable,
  (value) => editor.value?.setEditable(value !== false)
)

/** 外部内容变化（流式写入 / 清空 / 换文）时仅在确有差异时同步 */
watch(
  () => props.content,
  (value) => {
    const ed = editor.value
    if (!ed || value === ed.getMarkdown()) return
    ed.commands.setContent(value, { contentType: 'markdown', emitUpdate: false })
  }
)

onBeforeUnmount(() => editor.value?.destroy())
</script>
<style scoped lang="less">
.md-rich {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;

  &__toolbar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 2px;
    padding: 4px 8px;
    border-bottom: 1px solid var(--td-border-level-1-color);
  }

  &__block {
    width: 68px;
    flex-shrink: 0;
  }

  &__sep {
    width: 1px;
    height: 16px;
    margin: 0 4px;
    flex-shrink: 0;
    background: var(--td-border-level-1-color);
  }

  &__body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    cursor: text;
  }

  :deep(.t-button.is-active) {
    color: var(--td-brand-color);
    background: var(--td-brand-color-light);
  }
}
</style>
<style lang="less" src="./markdownRichEditor.less"></style>
