<template>
  <div class="article-editor">
    <editor-content
      :editor="editor"
      class="article-editor__content"
      :class="{ 'is-preview': mode === 'preview' }"
    />
  </div>
</template>
<script lang="ts" setup>
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { TableKit } from '@tiptap/extension-table'
import { resolveAssetRel } from '@/modules/tool/components/article/imageRef'
import { ArticleImage } from './ArticleImage'
import { ArticleSlash } from './ArticleSlash'

const props = defineProps<{
  content: string
  /** 编辑 / 预览模式（由侧边栏 header 控制） */
  mode: 'edit' | 'preview'
  /** 文章 md 所在目录（图片相对路径解析基准） */
  baseDir?: string
  /** 配图目录（assets/ 绝对路径，粘贴 / 拖入图片落盘于此） */
  assetsDir?: string
}>()

const emit = defineEmits<{
  (e: 'change', value: string): void
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
}

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
  editable: props.mode === 'edit',
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
  }
})

watch(
  () => props.mode,
  (value) => editor.value?.setEditable(value === 'edit')
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
    padding: 16px 20px;
    box-sizing: border-box;
  }
}
</style>
<style lang="less">
.article-editor__pm {
  outline: none;
  min-height: 100%;
  color: var(--td-text-color-primary);
  font-size: var(--td-font-size-body-large);
  line-height: 1.8;
  word-break: break-word;

  p {
    margin: 0 0 12px;
  }

  h1,
  h2,
  h3,
  h4 {
    color: var(--td-text-color-primary);
    font-weight: 600;
    line-height: 1.4;
    margin: 20px 0 12px;
  }

  h1 {
    font-size: 24px;
  }

  h2 {
    font-size: 20px;
  }

  h3 {
    font-size: 17px;
  }

  h4 {
    font-size: 15px;
  }

  ul,
  ol {
    padding-left: 22px;
    margin: 0 0 12px;
  }

  li {
    margin: 4px 0;
  }

  blockquote {
    margin: 0 0 12px;
    padding: 8px 16px;
    border-left: 3px solid var(--td-brand-color);
    background: var(--td-brand-color-light);
    color: var(--td-text-color-secondary);
  }

  code {
    padding: 2px 6px;
    border-radius: var(--td-radius-small);
    background: var(--td-bg-color-component);
    font-family: var(--td-font-family-mono);
    font-size: 0.9em;
  }

  pre {
    margin: 0 0 12px;
    padding: 12px 16px;
    border-radius: var(--td-radius-medium);
    background: var(--td-bg-color-component);
    overflow-x: auto;

    code {
      padding: 0;
      background: transparent;
    }
  }

  a {
    color: var(--td-brand-color);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 12px 0;
    border-radius: var(--td-radius-medium);
    border: 1px solid var(--td-border-level-1-color);
  }

  table {
    border-collapse: collapse;
    margin: 0 0 12px;
    width: 100%;
    font-size: var(--td-font-size-body-medium);

    th,
    td {
      border: 1px solid var(--td-border-level-1-color);
      padding: 6px 12px;
      text-align: left;
    }

    th {
      background: var(--td-bg-color-component);
      font-weight: 600;
    }
  }

  hr {
    border: none;
    border-top: 1px solid var(--td-border-level-1-color);
    margin: 16px 0;
  }
}

.article-editor__content.is-preview .article-editor__pm {
  cursor: default;
}
</style>
