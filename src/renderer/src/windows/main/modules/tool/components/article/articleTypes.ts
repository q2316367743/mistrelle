/**
 * 文章创作场景的数据模型（article 场景）。
 * 项目根目录：有工作空间时 {workspace}/articles/，否则 {sandbox}/outputs/articles/。
 * project.json 为项目管理索引（结构化），正文为 drafts/ 下的 .md，配图为 assets/ 下的图片。
 */

import { CommonSelect } from '@common/types/CommonSelect'

/** 目标平台（平台差异化模板） */
export type ArticlePlatform = '公众号' | '知乎' | '小红书' | '其他'

/** 各平台内置写作风格预设（侧边栏风格下拉与 article_* 工具共用同一词汇表；也接受自定义描述） */
export const ARTICLE_STYLE_PRESETS: Record<ArticlePlatform, string[]> = {
  公众号: ['深度长文', '干货科普', '情感故事', '热点评述'],
  知乎: ['专业解析', '个人经验', '观点辩论', '科普长文'],
  小红书: ['种草分享', '干货教程', '经验复盘', '测评清单'],
  其他: ['通用写作']
}

/** 文章状态 */
export type ArticleStatus = 'draft' | 'writing' | 'done'

/** 版本来源：original=创建初稿 humanize=去 AI 味 rewrite=风格重写 manual=手动 */
export type ArticleVersionSource = 'original' | 'humanize' | 'rewrite' | 'manual'

export const ARTICLE_VERSION_SOURCE_OPTIONS: Array<CommonSelect<ArticleVersionSource>> = [
  { value: 'original', label: '原稿' },
  { value: 'humanize', label: '去 AI 味' },
  { value: 'rewrite', label: '重写' },
  { value: 'manual', label: '手动' }
]

/** 朱雀 AIGC 检测结果（跟版本走；三占比 0-100，和为 100） */
export interface ZhuqueDetectResult {
  /** AI 生成占比 */
  ai: number
  /** 疑似 AI 占比 */
  suspect: number
  /** 人工创作占比 */
  human: number
  /** 检测时间戳 */
  time: number
}

/** 文章版本（正文迭代快照；检测结果跟版本走，封面/插图跟文章走） */
export interface ArticleVersion {
  id: string
  /** 正文文件相对 articles/ 的路径，如 drafts/{articleId}-{vid}.md */
  file: string
  source: ArticleVersionSource
  /** 自定义版本名（缺省按 source 显示） */
  label?: string
  /** 创建时间戳 */
  createdTime: number
  /** 字数（去空白字符数） */
  words?: number
  /** 朱雀检测结果 */
  zhuque?: ZhuqueDetectResult
}

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
  /** 写作风格：预设名（见 ARTICLE_STYLE_PRESETS）或自定义描述，AI 撰写 / 改写正文须遵循 */
  style?: string
  /** 提纲 */
  outline?: string
  /** 字数（由 article_stats 统计） */
  words?: number
  /** 封面图相对 articles/ 的路径 */
  cover?: string
  /** 配图相对 articles/ 的路径列表 */
  images?: string[]
  /** 正文版本列表（读时归一化兜底：存量无版本文章自动合成 V1） */
  versions?: ArticleVersion[]
  /** 当前激活版本 id（缺省取最后一个版本）；item.file 恒等于激活版本的 file */
  activeVersionId?: string
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
  style?: string
  outline?: string
}

/** 可被模型更新的文章字段（article_update 白名单，排除 id / file / words） */
export type ArticleUpdatePatch = Partial<
  Pick<
    ArticleItem,
    'title' | 'platform' | 'status' | 'summary' | 'style' | 'outline' | 'cover' | 'images'
  >
>
