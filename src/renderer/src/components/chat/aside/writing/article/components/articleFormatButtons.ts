/**
 * 工具栏格式按钮的元数据表与宽度常量（内联行与溢出面板共用，避免两处维护）。
 *
 * 顺序即内联优先级：宽度不够时**从后往前**收进「更多」面板，
 * 故最常用的加粗 / 斜体 / 列表 / 引用排在最前。
 */
import type { Component } from 'vue'
import {
  ClearFormattingIcon,
  CodeIcon,
  ForwardIcon,
  HighlightedBlockIcon,
  LinkIcon,
  ListNumberedIcon,
  MinusIcon,
  QuoteIcon,
  RollbackIcon,
  TableIcon,
  TextformatBoldIcon,
  TextformatItalicIcon,
  TextformatStrikethroughIcon,
  TextformatUnderlineIcon,
  ViewListIcon
} from 'tdesign-icons-vue-next'
import type { ArticleEditorCommand } from './articleEditorCommands'

/** 格式按钮分组（「更多」面板按组换行展示） */
export type ArticleFormatGroup = 'inline' | 'block' | 'history'

export const ArticleFormatGroupLabels: Record<ArticleFormatGroup, string> = {
  inline: '行内样式',
  block: '段落与列表',
  history: '历史'
}

export interface ArticleFormatButton {
  cmd: ArticleEditorCommand
  tip: string
  icon: Component
  group: ArticleFormatGroup
}

/**
 * 按钮全集（顺序 = 内联优先级，靠前优先留在工具栏）。
 * 仅收录 markdown 能表达的格式——正文以 markdown 落盘，样式类（颜色/对齐/高亮）存不住故不纳入。
 */
export const ARTICLE_FORMAT_BUTTONS: ArticleFormatButton[] = [
  { cmd: 'bold', tip: '加粗', icon: TextformatBoldIcon, group: 'inline' },
  { cmd: 'italic', tip: '斜体', icon: TextformatItalicIcon, group: 'inline' },
  { cmd: 'bulletList', tip: '无序列表', icon: ViewListIcon, group: 'block' },
  { cmd: 'blockquote', tip: '引用', icon: QuoteIcon, group: 'block' },
  { cmd: 'underline', tip: '下划线', icon: TextformatUnderlineIcon, group: 'inline' },
  { cmd: 'strike', tip: '删除线', icon: TextformatStrikethroughIcon, group: 'inline' },
  { cmd: 'link', tip: '链接', icon: LinkIcon, group: 'inline' },
  { cmd: 'orderedList', tip: '有序列表', icon: ListNumberedIcon, group: 'block' },
  { cmd: 'code', tip: '行内代码', icon: CodeIcon, group: 'inline' },
  { cmd: 'codeBlock', tip: '代码块', icon: HighlightedBlockIcon, group: 'block' },
  { cmd: 'table', tip: '插入 3×3 表格', icon: TableIcon, group: 'block' },
  { cmd: 'horizontalRule', tip: '分割线', icon: MinusIcon, group: 'block' },
  { cmd: 'undo', tip: '撤销', icon: RollbackIcon, group: 'history' },
  { cmd: 'redo', tip: '重做', icon: ForwardIcon, group: 'history' },
  { cmd: 'clearFormat', tip: '清除格式', icon: ClearFormattingIcon, group: 'history' }
]

// ─── 宽度常量（px，实测值；用于内联装不下时决定收谁进面板） ───────────

/** 单个方形图标按钮（含 tdesign 内边距） */
export const FORMAT_BUTTON_WIDTH = 28
/** 按钮之间的 gap */
export const FORMAT_GAP = 2
/** 分隔线（含左右 margin） */
export const FORMAT_SEP_WIDTH = 9
/** 块类型下拉（短名选项 + 箭头；与 ArticleFormatButtons.vue 的 .fmt__block 宽度一致） */
export const BLOCK_TYPE_WIDTH = 60
/** 「更多」触发按钮 */
export const MORE_BUTTON_WIDTH = 28
/**
 * 工具栏各段之间的 flex gap 总量。
 * 注意：宽度取自 ResizeObserver 的 contentRect（已排除 padding），故不再扣 padding。
 * 命名**刻意不以大写 T 开头**——TDesignResolver 会把 T 开头的大写名误判为 tdesign 组件
 * 并剥掉首字母（曾把 TOOLBAR_GAP_TOTAL 生成为 tdesign 的 'OOLBAR_GAP_TOTAL' 假全局）。
 */
export const FLEX_GAP_TOTAL = 16
/** 版本按钮最小可收缩宽度（窄栏下让位给格式区，超长文案由 ellipsis 截断） */
export const VERSION_MIN_WIDTH = 56
/** 插图 / 生图（纯图标 + tooltip）每个宽度 */
export const IMAGE_BUTTON_WIDTH = 28
/** 插图区与格式区之间至少保留的间隙 */
export const SECTION_GAP = 8

/** 块类型下拉选项宽度（面板内展示用，与内联同一份数据源在调用处传入） */
export const PANEL_MIN_WIDTH = 208
