/**
 * 笔记库树节点：支持文件夹嵌套。
 * - key：相对笔记库根目录的路径（note 不含 .md，folder 即相对目录路径），作为全局唯一标识
 * - 附件规范沿用 Obsidian 事实标准：note a 的附件放在同级 a.assets/ 目录
 */
export interface NoteNode {
  type: 'note' | 'folder'
  /** 名称（note 不含 .md 后缀） */
  name: string
  /** 相对根目录 key，如 drafts/idea、drafts */
  key: string
  /** 父目录相对根路径（根目录为 ''） */
  parentKey: string
  /** 绝对路径（note 为 md 文件，folder 为目录） */
  path: string
  size: number
  mtime: number
  children?: NoteNode[]
}
