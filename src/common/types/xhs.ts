/**
 * 小红书热点数据契约（main xhsHotNotes / preload 桥 / 渲染层 xhs_hot_notes 工具三方共用）。
 * 数据源：红狐 API（redfox.hk，鉴权头 X-API-KEY），TS 重写自 xhs-Skills 的 Python 脚本
 * fetch_xhs_hot_articles.py——不再生成 HTML 报告，结构化数据交 AI 解读。
 * 评分（totalScore / popularityScore / relevanceScore / recencyScore）由接口直接返回，不在客户端重算。
 */

/** 归一化后的热门笔记条目 */
export interface XhsHotNote {
  noteId: string
  title: string
  /** 笔记描述（正文片段 / 话题标签串） */
  desc: string
  /** 发布时间（源接口格式 YYYY-MM-DD HH:MM:SS，原样透出） */
  createTime: string
  /** 封面图 URL（平台 CDN，可能失效） */
  cover: string
  noteLink: string
  authorLink: string
  authorNickname: string
  /** 作者粉丝数（源接口可能缺失） */
  authorFans: number | null
  likedCount: number
  collectedCount: number
  commentsCount: number
  sharedCount: number
  /** 互动总数（源接口字段，缺失时按点赞 + 收藏 + 评论 + 分享求和） */
  interactiveCount: number
  /** 综合评分（主排序依据） */
  totalScore: number
  popularityScore: number
  relevanceScore: number
  recencyScore: number
}

/** 单关键词结果 */
export interface XhsKeywordResult {
  keyword: string
  /** 命中笔记总数（源接口 total，通常远大于返回条数） */
  total: number
  /** 平台给出的相关搜索词（平台当下真实说法，用于二次拓词） */
  relatedSearches: string[]
  /** 按 totalScore 降序，最多 maxItems 条 */
  items: XhsHotNote[]
}

export interface XhsHotNotesRequest {
  /** 红狐 API Key（凭证唯一真源在渲染层设置，随请求传入，main 不留存） */
  apiKey: string
  /** 关键词列表（逐个查询，最多 3 个；泛化词先按赛道词库下切） */
  keywords: string[]
  /** 回看天数（默认 30，上限 30） */
  days?: number
  /** 每关键词返回条数上限（默认 10，上限 20） */
  maxItems?: number
  /** 每页拉取条数（默认 50，上限 50；供接口分页，通常无需指定） */
  pageSize?: number
}

export interface XhsHotNotesResponse {
  /** 成功的关键词结果（部分失败不整体报错） */
  results?: XhsKeywordResult[]
  /** 失败的关键词及原因 */
  errors: string[]
}
