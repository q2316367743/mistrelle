<template>
  <div class="article-editor">
    <editor-content
      :editor="editor"
      class="article-editor__content"
      :class="{ 'is-preview': !editable }"
    />
  </div>
</template>
<script lang="ts" setup>
import { EditorContent, useEditor } from '@tiptap/vue-3'
import type { ChainedCommands } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { TableKit } from '@tiptap/extension-table'
import { resolveAssetRel } from '@/windows/main/modules/tool/components/article/imageRef'
import { ArticleImage } from './ArticleImage'
import { ArticleSlash } from './ArticleSlash'

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
  /** 选区变化（携带选中文本，无选区为空串）：父级据此启用 / 禁用插图生图 */
  (e: 'selection-change', text: string): void
}>()

/** 文件名清洗：去掉路径分隔与非法字符，保留扩展名 */
const sanitizeFileName = (name: string): string => {
  const base = name.replace(/[/\\:*?"<>|]/g, '_') || 'image.png'
  return base
}

/** 粘贴 / 拖入本地图片：写入 assets 目录并插入相对路径节点 */
const insertLocalImage = async (file: File) => {
  if (!props.assetsDir || !props.baseDir) return
  const fileName = sanitizeFileName(file.name)
  const assetPath = window.preload.path.join(props.assetsDir, `${Date.now()}_${fileName}`)
  try {
    await window.preload.fs.mkdir(props.assetsDir)
    await window.preload.fs.writeBinaryFile(assetPath, await file.arrayBuffer())
  } catch {
    return
  }
  const rel = resolveAssetRel(props.baseDir, assetPath)
  editor.value
    ?.chain()
    .focus()
    .insertContent({ type: 'image', attrs: { src: rel, alt: '' } })
    .run()
  emit('image-added', rel)
}

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

/** 执行一条 focus 后的编辑器命令（工具栏格式按钮） */
const exec = (fn: (chain: ChainedCommands) => ChainedCommands): void => {
  const ed = editor.value
  if (!ed) return
  fn(ed.chain().focus()).run()
}

defineExpose({
  insertImage,
  getSelection,
  toggleBold: () => exec((c) => c.toggleBold()),
  toggleItalic: () => exec((c) => c.toggleItalic()),
  toggleHeading2: () => exec((c) => c.toggleHeading({ level: 2 })),
  toggleBulletList: () => exec((c) => c.toggleBulletList()),
  toggleBlockquote: () => exec((c) => c.toggleBlockquote())
})

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] }
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
          if (file) void insertLocalImage(file)
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
      void insertLocalImage(file)
      event.preventDefault()
      return true
    }
  },
  onUpdate: ({ editor: ed }) => {
    emit('change', ed.getMarkdown())
  },
  // 选区变化即上报：工具栏「生图」按有无选中文字启用 / 禁用
  onSelectionUpdate: () => emit('selection-change', getSelection()),
  onCreate: () => emit('selection-change', getSelection())
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
