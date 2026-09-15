/**
 * 文章创作场景的数据模型（article 场景，schema=2）。
 * 项目根目录：有工作空间时 {workspace}/articles/，否则 {sandbox}/outputs/articles/。
 * 一篇文章 = 一个主题，可有多个「类型」（发布平台，如公众号/知乎/小红书）；
 * 每个类型拥有独立的版本序列与正文。类型由 AI 设定（自由命名），同一文章内标题+类型唯一；
 * 用户端只能查看与切换，不能新增或修改。
 * 旧结构（schema=1，一篇文章单平台/单版本列表）不迁移：读时 types 置空，由用户手动重建。
 */

import { CommonSelect } from '@common/types/CommonSelect'

/** 推荐平台名（仅供 AI 工具描述与提示词文案使用，不作为类型约束） */
export const ARTICLE_TYPES: string[] = ['公众号', '知乎', '小红书', '其他']

/** 版本来源：original=创建初稿 humanize=去 AI 味 rewrite=重写 manual=手动 */
export type ArticleVersionSource = 'original' | 'humanize' | 'rewrite' | 'manual'

export const ARTICLE_VERSION_SOURCE_OPTIONS: Array<CommonSelect<ArticleVersionSource>> = [
  { value: 'original', label: '原稿' },
  { value: 'humanize', label: '去 AI 味' },
  { value: 'rewrite', label: '重写' },
  { value: 'manual', label: '手动' }
]

/** 版本展示名：自定义 label 优先，缺省按 source 显示 */
export const articleVersionLabel = (v: ArticleVersion): string =>
  v.label ?? ARTICLE_VERSION_SOURCE_OPTIONS.find((o) => o.value === v.source)?.label ?? '版本'

/** 版本完整标题：第N版 · 展示名 */
export const articleVersionTitle = (v: ArticleVersion): string => `第${v.no}版 · ${articleVersionLabel(v)}`

/** 文章版本（单个类型内的正文迭代快照；封面/插图跟类型走）。
 *  版本 id 即「标题+类型+版本」单元标识：article_create 返回它，article_write / read / stats 只认它 */
export interface ArticleVersion {
  id: string
  /** 显式版本号（同一类型内递增，创建时 max+1；删除中间版本不影响既有编号） */
  no: number
  /** 正文文件相对 articles/ 的路径，如 drafts/{articleId}-{vid}.md */
  file: string
  source: ArticleVersionSource
  /** 自定义版本名（缺省按 source 显示） */
  label?: string
  /** 创建时间戳 */
  createdTime: number
  /** 字数（去空白字符数） */
  words?: number
}

/** 类型条目：一个平台 = 独立的版本序列与正文 */
export interface ArticleTypeEntry {
  /** 平台名（AI 设定的自由字符串，同一文章内唯一） */
  type: string
  /** 正文文件相对 articles/ 根目录的路径，恒等于激活版本的 file */
  file: string
  /** 封面图相对 articles/ 的路径（封面比例固定 16:9） */
  cover?: string
  /** 配图相对 articles/ 的路径列表 */
  images?: string[]
  /** 正文版本列表（读时归一化兜底） */
  versions?: ArticleVersion[]
  /** 当前激活版本 id（缺省取最后一个版本） */
  activeVersionId?: string
  /** 字数（article_stats 统计回写） */
  words?: number
}

/** 文章条目（一个主题；登记在 project.json） */
export interface ArticleItem {
  id: string
  title: string
  /** 一句话选题 / 摘要 */
  summary?: string
  /** 提纲（文章级，各类型写作共用） */
  outline?: string
  /** 类型列表（至少一个；空表示待创建） */
  types: ArticleTypeEntry[]
}

/** 文章项目管理索引文件结构（project.json，schema=2） */
export interface ArticleProject {
  schema: 2
  /** 项目名称（可选，用于侧边栏辨识） */
  title: string
  updatedTime: number
  articles: ArticleItem[]
}

/** 新增文章单元的可选字段（article_create）：返回值即单元（版本）id */
export interface ArticleCreateInput {
  title: string
  /** 首个类型（发布平台），缺省「其他」 */
  type?: string
  /** 版本号，缺省自动（新类型=1，已有类型=最新版本号+1；同号已存在则复用返回已有 id） */
  version?: number
  summary?: string
  outline?: string
}

/** 文章级可更新字段（article_update，排除 id / types 内部结构） */
export type ArticleUpdatePatch = Partial<Pick<ArticleItem, 'title' | 'summary' | 'outline'>>

/** 类型级可更新字段（article_update 按 type 作用；type 不存在自动创建） */
export type ArticleTypePatch = Partial<Pick<ArticleTypeEntry, 'cover' | 'images'>>
