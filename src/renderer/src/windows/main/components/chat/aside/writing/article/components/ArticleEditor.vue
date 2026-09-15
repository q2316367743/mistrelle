<template>
  <div class="article-editor">
    <editor-content
      :editor="editor"
      class="article-editor__content"
      :class="{ 'is-preview': !editable }"
    />
    <!-- 选中文字：常用格式悬浮框（与顶部工具栏共用同一命令面） -->
    <article-bubble-menu v-if="editor" :editor="editor" :disabled="!editable" />
    <!-- 选中图片：图片操作悬浮框（复制 / 换图 / AI 重新生成 / 删除） -->
    <article-image-menu
      v-if="editor"
      :editor="editor"
      :disabled="!editable"
      :base-dir="baseDir ?? ''"
      :assets-dir="assetsDir ?? ''"
      @image-changed="(rel) => emit('image-added', rel)"
      @image-removed="handleImageRemoved"
      @regen="(payload) => emit('image-regen', payload)"
    />
  </div>
</template>
<script lang="ts" setup>
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { TableKit } from '@tiptap/extension-table'
import { ArticleImage } from './ArticleImage'
import { ArticleSlash } from './ArticleSlash'
import ArticleBubbleMenu from './ArticleBubbleMenu.vue'
import ArticleImageMenu from './ArticleImageMenu.vue'
import {
  applyBlockType,
  applyCommand,
  isSameEditorState,
  readEditorState,
  type ArticleBlockType,
  type ArticleEditorCommand,
  type ArticleEditorState
} from './articleEditorCommands'
import {
  insertLocalImageFile,
  countImageRefs,
  replaceImageAt as replaceImageNodeAt,
  type ArticleImageContext
} from './articleEditorImages'

const props = defineProps<{
  content: string
  /** 是否可编辑（默认 true；流式改写等场景由父级传 false 锁定） */
  editable?: boolean
  /** 文章 md 所在目录（图片相对路径解析基准） */
  baseDir?: string
  /** 配图目录（assets/ 绝对路径，粘贴 / 拖入图片落盘于此） */
  assetsDir?: string
}>()

const emit = defineEmits<{
  (e: 'change', value: string): void
  /** 本地图片粘贴 / 拖入落盘后通知父级登记进插图列表（rel 为相对 md 目录的引用路径） */
  (e: 'image-added', rel: string): void
  /** 图片彻底不再被引用（悬浮框删除且全文已无同图）时通知父级清理插图列表 */
  (e: 'image-removed', rel: string): void
  /** 图片悬浮框请求 AI 重新生成：父级持有文章语境，负责开弹窗并回调 replaceImageAt */
  (e: 'image-regen', payload: { pos: number; blockText: string }): void
  /** 选区变化（携带选中文本，无选区为空串）：父级据此启用 / 禁用插图生图 */
  (e: 'selection-change', text: string): void
  /** 编辑器状态快照（格式 active / 块类型 / 撤销可用性）：顶部工具栏据此联动 */
  (e: 'state-change', state: ArticleEditorState): void
}>()

/**
 * 供外部把图片插入正文（工具栏「插图」上传 / 生图完成回调）。
 * 图片是块级节点，直接 insertContent 会**替换掉选中的文字**——而选中恰恰是用户用来指明
 * 「图放这里 / 按这段画」的，不该被吃掉。故有选区时插到选中块的**之后**，无选区才插在光标处。
 */
const insertImage = (rel: string) => {
  const ed = editor.value
  if (!ed) return
  const node = { type: 'image', attrs: { src: rel, alt: '' } }
  const { selection } = ed.state
  if (selection.from !== selection.to) {
    const $to = selection.$to
    // after(1) = 选区末尾所在顶层块的结束位置（跨段选中时即最后一段之后）
    const pos = $to.depth >= 1 ? $to.after(1) : selection.to
    ed.chain().focus().insertContentAt(pos, node).run()
    return
  }
  ed.chain().focus().insertContent(node).run()
}

/** 读取当前选区文本（插图弹窗据此让 AI 起草贴合所选段落的画面描述；无选区返回空串） */
const getSelection = (): string => {
  const ed = editor.value
  if (!ed) return ''
  const { from, to } = ed.state.selection
  if (from === to) return ''
  return ed.state.doc.textBetween(from, to, '\n').trim()
}

/**
 * 图片悬浮框「AI 重新生成」的语境：图片所在**顶层块**的文字 + 当前选区（若有）。
 * 以所在段落为核心，避免让模型画成泛泛的全文配图。
 */
const getImageContext = (): ArticleImageContext => {
  const ed = editor.value
  if (!ed) return { blockText: '' }
  const { $from } = ed.state.selection
  const depth = Math.min(1, $from.depth)
  const block = depth >= 1 ? $from.node(depth) : null
  return {
    blockText: block?.textContent?.trim() ?? '',
    selection: getSelection()
  }
}

/** 编辑命令统一入口（工具栏 + 悬浮框均走此处，取代原先 8 个独立 toggle 方法） */
const runCommand = (cmd: ArticleEditorCommand): void => {
  const ed = editor.value
  if (!ed) return
  applyCommand(ed, cmd)
}

/** 设置光标所在块类型（工具栏块类型下拉） */
const setBlockType = (type: ArticleBlockType): void => {
  const ed = editor.value
  if (!ed) return
  applyBlockType(ed.chain().focus(), type).run()
}

/** 就地替换某位置的图片（图片悬浮框「AI 重新生成」完成后回填） */
const replaceImageAt = (pos: number, rel: string): void => {
  const ed = editor.value
  if (!ed) return
  replaceImageNodeAt(ed, pos, rel)
}

/**
 * 图片被删除：仅当**全文已无任何节点引用同一张图**时才上报，
 * 避免还有别处用着就把它从文章插图列表里摘掉（AI 侧应该仍能看见这张图）。
 */
const handleImageRemoved = (rel: string): void => {
  const ed = editor.value
  if (!ed || countImageRefs(ed, rel) > 0) return
  emit('image-removed', rel)
}

defineExpose({
  insertImage,
  getSelection,
  getImageContext,
  replaceImageAt,
  runCommand,
  setBlockType
})

/** 上次上报的快照（浅比较用）；须在 useEditor 之前声明——onCreate 会在 useEditor 内同步触发 */
let lastState: ArticleEditorState | null = null

/** 粘贴 / 拖入本地图片：写入 assets 目录、插入节点、通知父级登记 */
const handleLocalImage = async (file: File): Promise<void> => {
  const ed = editor.value
  if (!ed || !props.assetsDir || !props.baseDir) return
  const rel = await insertLocalImageFile(ed, file, props.assetsDir, props.baseDir)
  if (rel) emit('image-added', rel)
}

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      // 编辑器内点击链接只落光标、不跳转（外链跳转由系统浏览器承担，避免误触离开编辑区）
      link: { openOnClick: false }
    }),
    Markdown,
    ArticleImage.configure({ baseDir: props.baseDir ?? '' }),
    ArticleSlash.configure({ baseDir: props.baseDir ?? '', assetsDir: props.assetsDir ?? '' }),
    TableKit
  ],
  content: props.content,
  contentType: 'markdown',
  editable: props.editable !== false,
  editorProps: {
    attributes: { class: 'article-editor__pm' },
    handlePaste: (_view, event) => {
      const data = event.clipboardData
      if (!data) return false
      for (let i = 0; i < data.items.length; i++) {
        if (data.items[i].type.startsWith('image/')) {
          const file = data.items[i].getAsFile()
          if (file) void handleLocalImage(file)
          event.preventDefault()
          return true
        }
      }
      return false
    },
    handleDrop: (_view, event) => {
      const files = event.dataTransfer?.files
      if (!files || files.length === 0) return false
      const file = files[0]
      if (!file.type.startsWith('image/')) return false
      void handleLocalImage(file)
      event.preventDefault()
      return true
    }
  },
  onUpdate: ({ editor: ed }) => {
    emit('change', ed.getMarkdown())
  },
  // 每次 transaction 都重算快照，仅在**确有变化**时上报，避免每敲一键就重渲染工具栏
  onTransaction: ({ editor: ed }) => {
    const next = readEditorState(ed)
    if (lastState && isSameEditorState(lastState, next)) return
    lastState = next
    emit('state-change', next)
  },
  // 选区变化即上报：工具栏「生图」按有无选中文字启用 / 禁用
  onSelectionUpdate: () => emit('selection-change', getSelection()),
  onCreate: ({ editor: ed }) => {
    emit('selection-change', getSelection())
    lastState = readEditorState(ed)
    emit('state-change', lastState)
  }
})

watch(
  () => props.editable,
  (value) => editor.value?.setEditable(value !== false)
)

/** 外部内容变化（切换文章重挂载由父级 :key 处理，此处兜底外部写入）时仅在确有差异时同步 */
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
.article-editor {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--td-bg-color-container);

  &__content {
    flex: 1;
    overflow: auto;
    padding: 16px 20px 24px;
    box-sizing: border-box;
  }
}
</style>
<style lang="less" src="./articleEditorContent.less"></style>
