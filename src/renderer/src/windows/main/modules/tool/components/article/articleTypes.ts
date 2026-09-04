/**
 * 文章创作场景的数据模型（article 场景）。
 * 项目根目录：有工作空间时 {workspace}/articles/，否则 {sandbox}/outputs/articles/。
 * project.json 为项目管理索引（结构化），正文为 drafts/ 下的 .md，配图为 assets/ 下的图片。
 */

/** 目标平台（平台差异化模板） */
export type ArticlePlatform = '公众号' | '知乎' | '小红书' | '其他'

/** 文章状态 */
export type ArticleStatus = 'draft' | 'writing' | 'done'

/** 文章条目（登记在 project.json） */
export interface ArticleItem {
  id: string
  title: string
  platform: ArticlePlatform
  status: ArticleStatus
  /** 正文文件相对 articles/ 根目录的路径，如 drafts/xxx.md */
  file: string
  /** 一句话选题 / 摘要 */
  summary?: string
  /** 提纲 */
  outline?: string
  /** 字数（由 article_stats 统计） */
  words?: number
  /** 封面图相对 articles/ 的路径 */
  cover?: string
  /** 配图相对 articles/ 的路径列表 */
  images?: string[]
}

/** 文章项目管理索引文件结构（project.json） */
export interface ArticleProject {
  schema: 1
  /** 项目名称（可选，用于侧边栏辨识） */
  title: string
  updatedTime: number
  articles: ArticleItem[]
}

/** 新增文章的可选字段（article_create） */
export interface ArticleCreateInput {
  title: string
  platform: ArticlePlatform
  summary?: string
  outline?: string
}

/** 可被模型更新的文章字段（article_update 白名单，排除 id / file / words） */
export type ArticleUpdatePatch = Partial<
  Pick<ArticleItem, 'title' | 'platform' | 'status' | 'summary' | 'outline' | 'cover' | 'images'>
>
