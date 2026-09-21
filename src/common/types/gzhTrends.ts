/**
 * 公众号爆款数据契约（main gzhTrends / preload 桥 / 渲染层 gzh_trends 工具三方共用）。
 * 数据源：onetotenvip.com SkillHub 接口快照；TS 重写自 gzh-Skills 两个 Python 脚本。
 */

/** 归一化后的爆款文章 */
export interface GzhTrendArticle {
  /** 命中榜单中文名（低粉高阅读 / 阅读靠前 / 数据增长中 / 原创靠前） */
  category: string
  /** 命中关键词 */
  keyword: string
  title: string
  accountName: string
  fans: string
  publicTime: string
  link: string
  /** 阅读数原始串（源站可能返回 "10w+"） */
  reads: string
  likes: number
  comments: number
  shares: number
  interactive: number
  /** 数据表现分 0-100（对数加权 + 榜单特化加分） */
  score: number
}

/** keyword 模式单关键词结果 */
export interface GzhKeywordResult {
  keyword: string
  /** 四榜各自 Top N（榜单内按分数降序） */
  boards: Array<{ key: string; label: string; items: GzhTrendArticle[] }>
  /** 跨榜合并（分数轮选保证榜单多样性）Top N */
  merged: GzhTrendArticle[]
}

/** sector 模式单赛道结果 */
export interface GzhSectorResult {
  name: string
  keywords: string[]
  /** 多关键词合并去重排序 Top N */
  items: GzhTrendArticle[]
  totalFetched: number
}

export interface GzhTrendsRequest {
  mode: 'keyword' | 'sector'
  /** keyword 模式：关键词列表（逐个查询，最多 5 个） */
  keywords: string[]
  /** sector 模式：赛道定义（赛道名 + 细分词组，最多 5 个赛道） */
  sectors?: Array<{ name: string; keywords: string[] }>
  /** 回看天数（默认 7，上限 30） */
  days?: number
  /** 每榜 / 每赛道返回条数上限（默认 10，上限 30） */
  maxItems?: number
}

export interface GzhTrendsResponse {
  keywordResults?: GzhKeywordResult[]
  sectorResults?: GzhSectorResult[]
  /** 失败的关键词 / 赛道及原因（部分失败不整体报错） */
  errors: string[]
}
