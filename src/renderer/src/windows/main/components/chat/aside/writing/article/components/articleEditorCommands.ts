/**
 * 文章编辑器命令面与状态快照（工具栏 / 悬浮框 / 拖拽手柄共用）。
 *
 * 设计要点：
 * - 编辑器是唯一权威：工具栏不猜当前格式，而是消费编辑器每次 transaction 后推来的快照。
 * - 正文以 **markdown** 落盘（getMarkdown / setContent(md)），故此处只暴露 markdown 能表达的
 *   格式；颜色 / 对齐 / 高亮等无 markdown 语法的样式刻意不纳入，避免存不住。
 * - 全部为纯函数（除 applyLinkDialog 需要弹窗），不含 Vue 依赖，便于编辑器与 UI 双侧复用。
 */
import type { ChainedCommands, Editor } from '@tiptap/core'
import type { CommonSelect } from '@/domain'
import { openLinkDialog } from './LinkDialog'

/** 块级类型（光标所在块的形态；工具判断块类型时以 editor.isActive 为准） */
export type ArticleBlockType =
  'paragraph' | 'heading1' | 'heading2' | 'heading3' | 'heading4' | 'blockquote' | 'codeBlock'

/**
 * 块类型下拉选项。label 取**短名**（正文 / H1 / 引用…）：该下拉在工具栏内联展示，
 * 窄栏（默认 232px）下必须与格式按钮共存，故刻意不用「一级标题」这类长名。
 */
export const ArticleBlockTypeOptions: Array<CommonSelect<ArticleBlockType>> = [
  { label: '正文', value: 'paragraph' },
  { label: 'H1', value: 'heading1' },
  { label: 'H2', value: 'heading2' },
  { label: 'H3', value: 'heading3' },
  { label: 'H4', value: 'heading4' },
  { label: '引用', value: 'blockquote' },
  { label: '代码块', value: 'codeBlock' }
]

/** 行内 / 列表 / 块级 / 历史 的单条命令（工具栏与悬浮框按钮均以它派发） */
export type ArticleEditorCommand =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'code'
  | 'link'
  | 'bulletList'
  | 'orderedList'
  | 'blockquote'
  | 'codeBlock'
  | 'horizontalRule'
  | 'table'
  | 'undo'
  | 'redo'
  | 'clearFormat'

/**
 * 编辑器状态快照：工具栏据此渲染 active / disabled 态与块类型下拉的选中项。
 * 不随光标联动的字段（如是否有图片被选）另行放置在下方 imageSelected。
 */
export interface ArticleEditorState {
  /** 行内标记激活态 */
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  code: boolean
  link: boolean
  /** 光标所在块的形态（下拉框选中项） */
  blockType: ArticleBlockType
  /** 列表激活态（与 blockType 正交：列表项内部块类型仍是 paragraph） */
  bulletList: boolean
  orderedList: boolean
  /** 是否在表格内（决定表格增删按钮是否可用） */
  inTable: boolean
  /** 是否选中了图片节点（决定是否显示图片悬浮框） */
  imageSelected: boolean
  canUndo: boolean
  canRedo: boolean
}

/** 读取当前块类型：无匹配时回落 paragraph（如列表项内、表格单元格内） */
export const readBlockType = (editor: Editor): ArticleBlockType => {
  for (let level = 1; level <= 4; level++) {
    if (editor.isActive('heading', { level })) {
      return `heading${level}` as ArticleBlockType
    }
  }
  if (editor.isActive('blockquote')) return 'blockquote'
  if (editor.isActive('codeBlock')) return 'codeBlock'
  return 'paragraph'
}

/** 生成编辑器状态快照（编辑器 onTransaction 时调用） */
export const readEditorState = (editor: Editor): ArticleEditorState => ({
  bold: editor.isActive('bold'),
  italic: editor.isActive('italic'),
  underline: editor.isActive('underline'),
  strike: editor.isActive('strike'),
  code: editor.isActive('code'),
  link: editor.isActive('link'),
  blockType: readBlockType(editor),
  bulletList: editor.isActive('bulletList'),
  orderedList: editor.isActive('orderedList'),
  inTable: editor.isActive('table'),
  imageSelected: editor.isActive('image'),
  canUndo: editor.can().undo(),
  canRedo: editor.can().redo()
})

/** 浅比较两份快照，用于避免每次输入都触发工具栏重渲染 */
export const isSameEditorState = (a: ArticleEditorState, b: ArticleEditorState): boolean =>
  a.bold === b.bold &&
  a.italic === b.italic &&
  a.underline === b.underline &&
  a.strike === b.strike &&
  a.code === b.code &&
  a.link === b.link &&
  a.blockType === b.blockType &&
  a.bulletList === b.bulletList &&
  a.orderedList === b.orderedList &&
  a.inTable === b.inTable &&
  a.imageSelected === b.imageSelected &&
  a.canUndo === b.canUndo &&
  a.canRedo === b.canRedo

/** 空快照：编辑器尚未挂载时工具栏的初值 */
export const EMPTY_EDITOR_STATE: ArticleEditorState = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  code: false,
  link: false,
  blockType: 'paragraph',
  bulletList: false,
  orderedList: false,
  inTable: false,
  imageSelected: false,
  canUndo: false,
  canRedo: false
}

/** 设置块类型（h1~h4 → toggleHeading，使同类型再点可回到正文） */
export const applyBlockType = (chain: ChainedCommands, type: ArticleBlockType): ChainedCommands => {
  if (type === 'paragraph') return chain.setParagraph()
  if (type === 'blockquote') return chain.toggleBlockquote()
  if (type === 'codeBlock') return chain.toggleCodeBlock()
  const level = Number(type.replace('heading', '')) as 1 | 2 | 3 | 4
  return chain.toggleHeading({ level })
}

/** 清除格式：去掉全部行内标记，并把块内联类型归正 */
export const applyClearFormat = (chain: ChainedCommands): ChainedCommands =>
  chain.unsetAllMarks().clearNodes()

/**
 * 执行一条命令。
 * link 需要先取用户输入（命令式弹窗），故单独走 openLinkDialog 分支；其余直接落到链上。
 * 调用方负责传入已 focus 的链。
 */
export const applyCommand = (editor: Editor, cmd: ArticleEditorCommand): void => {
  if (cmd === 'link') {
    openLinkDialog({
      currentHref: editor.getAttributes('link').href as string | undefined,
      onConfirm: (href) => {
        const chain = editor.chain().focus().extendMarkRange('link')
        if (!href) chain.unsetLink().run()
        else chain.setLink({ href }).run()
      }
    })
    return
  }
  const chain = editor.chain().focus()
  switch (cmd) {
    case 'bold':
      chain.toggleBold().run()
      return
    case 'italic':
      chain.toggleItalic().run()
      return
    case 'underline':
      chain.toggleUnderline().run()
      return
    case 'strike':
      chain.toggleStrike().run()
      return
    case 'code':
      chain.toggleCode().run()
      return
    case 'bulletList':
      chain.toggleBulletList().run()
      return
    case 'orderedList':
      chain.toggleOrderedList().run()
      return
    case 'blockquote':
      chain.toggleBlockquote().run()
      return
    case 'codeBlock':
      chain.toggleCodeBlock().run()
      return
    case 'horizontalRule':
      chain.setHorizontalRule().run()
      return
    case 'table':
      chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
      return
    case 'undo':
      chain.undo().run()
      return
    case 'redo':
      chain.redo().run()
      return
    case 'clearFormat':
      applyClearFormat(chain).run()
      return
  }
}

/** 命令的 active 态（仅有激活概念的标记类命令需要；其余返回 false） */
export const readCommandActive = (
  state: ArticleEditorState,
  cmd: ArticleEditorCommand
): boolean => {
  switch (cmd) {
    case 'bold':
      return state.bold
    case 'italic':
      return state.italic
    case 'underline':
      return state.underline
    case 'strike':
      return state.strike
    case 'code':
      return state.code
    case 'link':
      return state.link
    case 'bulletList':
      return state.bulletList
    case 'orderedList':
      return state.orderedList
    case 'blockquote':
      return state.blockType === 'blockquote'
    case 'codeBlock':
      return state.blockType === 'codeBlock'
    default:
      return false
  }
}

/** 命令是否可用（撤销 / 重做按历史栈；其余恒可用） */
export const readCommandEnabled = (
  state: ArticleEditorState,
  cmd: ArticleEditorCommand
): boolean => {
  if (cmd === 'undo') return state.canUndo
  if (cmd === 'redo') return state.canRedo
  return true
}
