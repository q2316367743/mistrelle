import { Extension, type Editor } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion from '@tiptap/suggestion'
import { makeSuggestionRenderer } from '@/utils/suggestionRenderer'
import { saveNoteImage } from '@/modules/note'

export interface NoteSlashOptions {
  /** 笔记库根目录（~/.mistrelle/project/{id}/notes） */
  root: string
  /** 当前笔记 key（相对 note 根，不含 .md；「图片」命令把图片落盘到 {name}.assets/） */
  noteKey: string
}

export interface NoteSlashItem {
  title: string
  desc: string
  apply: (editor: Editor) => void
}

export const noteSlashPluginKey = new PluginKey('noteSlash')

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico']

/** 「图片」命令：文件选择器选本地图片 → 拷入 {note}.assets/ → 插入相对路径节点 */
const insertImageFromDisk = async (options: NoteSlashOptions, editor: Editor) => {
  const paths = await window.preload.inject.dialog.open({
    title: '选择图片',
    properties: ['openFile'],
    filters: [{ name: '图片', extensions: IMAGE_EXTENSIONS }]
  })
  const filePath = paths?.[0]
  if (!filePath) return
  try {
    const rel = await saveNoteImage(options.root, options.noteKey, { sourcePath: filePath })
    editor
      .chain()
      .focus()
      .insertContent({ type: 'image', attrs: { src: rel, alt: '' } })
      .run()
  } catch {
    return
  }
}

const buildItems = (options: NoteSlashOptions): NoteSlashItem[] => [
  { title: '正文', desc: '普通段落', apply: (e) => { void e.chain().focus().setParagraph().run() } },
  { title: '一级标题', desc: 'H1', apply: (e) => { void e.chain().focus().toggleHeading({ level: 1 }).run() } },
  { title: '二级标题', desc: 'H2', apply: (e) => { void e.chain().focus().toggleHeading({ level: 2 }).run() } },
  { title: '三级标题', desc: 'H3', apply: (e) => { void e.chain().focus().toggleHeading({ level: 3 }).run() } },
  { title: '加粗', desc: '粗体文字', apply: (e) => { void e.chain().focus().toggleBold().run() } },
  { title: '斜体', desc: '斜体文字', apply: (e) => { void e.chain().focus().toggleItalic().run() } },
  { title: '删除线', desc: '划线文字', apply: (e) => { void e.chain().focus().toggleStrike().run() } },
  { title: '无序列表', desc: '项目符号列表', apply: (e) => { void e.chain().focus().toggleBulletList().run() } },
  { title: '有序列表', desc: '编号列表', apply: (e) => { void e.chain().focus().toggleOrderedList().run() } },
  { title: '引用', desc: '引用段落', apply: (e) => { void e.chain().focus().toggleBlockquote().run() } },
  { title: '代码块', desc: '等宽代码', apply: (e) => { void e.chain().focus().toggleCodeBlock().run() } },
  { title: '分割线', desc: '水平分隔', apply: (e) => { void e.chain().focus().setHorizontalRule().run() } },
  {
    title: '表格',
    desc: '3 × 3 表格',
    apply: (e) => { void e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() }
  },
  { title: '图片', desc: '从本地选择图片插入', apply: (e) => { void insertImageFromDisk(options, e) } }
]

/**
 * 笔记斜杠命令（/ 唤起命令菜单）：基于 @tiptap/suggestion 实现，
 * 复用通用 suggestion 弹层渲染器。命令作用于当前光标，选中后删除触发文本并执行。
 */
export const NoteSlash = Extension.create<NoteSlashOptions>({
  name: 'noteSlash',
  addOptions() {
    return { root: '', noteKey: '' }
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        pluginKey: noteSlashPluginKey,
        allowSpaces: false,
        startOfLine: false,
        decorationTag: 'span',
        // 代码块内输入 / 按字面处理，不唤起菜单
        shouldShow: ({ editor }) => !editor.isActive('codeBlock'),
        items: ({ query }) =>
          buildItems(this.options).filter((item) =>
            `${item.title} ${item.desc}`.toLowerCase().includes(query.toLowerCase())
          ),
        command: ({ editor, range, props }) => {
          editor.chain().focus().deleteRange(range).run()
          props.apply(editor)
        },
        render: makeSuggestionRenderer((item) => {
          const i = item as NoteSlashItem
          return { title: i.title, desc: i.desc }
        })
      })
    ]
  }
})
