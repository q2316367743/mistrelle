/**
 * 短篇小说场景的数据模型（novelShort 场景）。
 * 项目根目录：有工作空间时 {workspace}/novels/，否则 {sandbox}/outputs/novels/。
 * project.json 为项目管理索引（结构化），每篇小说一个子目录 {id}/，
 * 内含 story.md（正文）/ outline.md（大纲）/ characters.md（角色卡）/ setting.md（背景设定+主题）/ style.md（文风设定）。
 * 短篇相对长篇精简：无伏笔 / 暗线 / 时间线 / 多卷分层，设定固定 5 个 md 文件、轻量。
 */

/** 小说状态 */
export type NovelStatus = 'draft' | 'writing' | 'done'

/** 小说条目内各文件键（正文 + 4 个设定文件，prompt / 工具 / 侧边栏共用单一数据源） */
export const NOVEL_FILES = {
  story: 'story.md',
  characters: 'characters.md',
  outline: 'outline.md',
  setting: 'setting.md',
  style: 'style.md'
} as const

export type NovelFileKey = keyof typeof NOVEL_FILES

/** 小说条目（登记在 project.json） */
export interface NovelItem {
  id: string
  title: string
  /** 题材（科幻 / 言情 / 悬疑 / 都市...） */
  genre: string
  status: NovelStatus
  /** 子目录相对 novels/ 根目录的路径（{id}/，正文与设定文件都落于此） */
  dir: string
  /** 一句话创意 / 摘要 */
  summary?: string
  /** 字数（预留，后续实现统计时回写） */
  words?: number
}

/** 小说项目管理索引文件结构（project.json） */
export interface NovelProject {
  schema: 1
  title: string
  updatedTime: number
  novels: NovelItem[]
}

/** 新增小说的可选字段（novel_create） */
export interface NovelCreateInput {
  title: string
  genre: string
  summary?: string
}

/** 可被模型更新的小说字段（novel_update 白名单，排除 id / dir / words） */
export type NovelUpdatePatch = Partial<Pick<NovelItem, 'title' | 'genre' | 'status' | 'summary'>>
