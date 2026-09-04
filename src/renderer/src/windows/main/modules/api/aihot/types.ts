// ==========================================
//  AIHOT 公开 API 类型定义
//  来源：https://aihot.virxact.com/openapi-v1.json（v1.2.0，OpenAPI 3.1）
//  匿名只读、无需鉴权；date / date-time 均以 string 表示
// ==========================================

/** 来源站点 */
export interface AihotSource {
  name: string
}

/** 署名（转载来源归属） */
export interface AihotAttribution {
  name: string
  url: string
}

export interface AihotItemLinks {
  aihot: string
  original: string
}

export interface AihotItem {
  id: string
  title: string
  originalTitle: string | null
  summary: string | null
  source: AihotSource
  links: AihotItemLinks
  publishedAt: string | null
  discoveredAt: string
  /** 当前值：ai-models / ai-products / industry / paper / tip，须容忍新值 */
  category: string | null
  /** 0–100 */
  score: number | null
  selected: boolean
  /** 推荐理由（仅 /api/v1/items 返回，其余端点不含） */
  reason?: string | null
  attribution?: AihotAttribution
}

export interface AihotItemMinimalLinks {
  aihot: string
}

/** 精选集 minimal 字段集：较 AihotItem 去掉 originalTitle / summary / links.original / reason / attribution */
export interface AihotItemMinimal {
  id: string
  title: string
  source: AihotSource
  links: AihotItemMinimalLinks
  publishedAt: string | null
  discoveredAt: string
  category: string | null
  score: number | null
  selected: boolean
}

/** 分页信息（nextCursor 不透明，仅同查询复用） */
export interface AihotPage {
  count: number
  hasMore: boolean
  nextCursor: string | null
}

/** /api/v1/items 响应内的查询回显 */
export interface AihotItemsQuery {
  mode: 'selected' | 'all'
  category: string | null
  window: '24h' | '7d'
  q: string | null
  by: 'timeline' | 'published'
  ordering: 'timelineDesc' | 'publishedAtDesc'
}

export interface AihotItemsResponse {
  schemaVersion: 1
  query: AihotItemsQuery
  items: AihotItem[]
  page: AihotPage
}

export interface AihotHotTopicLinks {
  aihot: string
  original: string
  story?: string
}

export interface AihotHotTopic {
  rank: number
  id: string
  title: string
  source: AihotSource
  links: AihotHotTopicLinks
  sourceCount: number
  signalCount: number
  sourceNames: string[]
  latestAt: string
}

export interface AihotHotTopicsResponse {
  schemaVersion: 1
  count: number
  items: AihotHotTopic[]
}

export interface AihotStoryReportLinks {
  aihot: string
  original?: string
}

export interface AihotStoryReport {
  id: string
  title: string
  summary: string | null
  source: { name: string; firstParty: boolean }
  publishedAt: string
  links: AihotStoryReportLinks
}

/** 事件的相邻故事（storyline 时间线前驱 / related 相关） */
export interface AihotStoryNeighbor {
  publicId: string
  title: string
  relation: string
  links: { aihot: string; api: string }
}

export interface AihotStory {
  publicId: string
  title: string
  status: 'active' | 'settled'
  sourceCount: number
  reportCount: number
  firstReportAt: string
  latestAt: string
  latest: string
  /** AI 摘要，随事件演进增量重写 */
  digest: string | null
  digestUpdatedAt: string | null
  links: { aihot: string }
  reports: AihotStoryReport[]
  storyline: AihotStoryNeighbor[]
  related: AihotStoryNeighbor[]
}

export interface AihotStoryResponse {
  schemaVersion: 1
  story: AihotStory
}

/** 日报归档索引条目 */
export interface AihotDailyEntry {
  date: string
  generatedAt: string
  leadTitle: string | null
  leadParagraph: string | null
  links: { aihot: string }
  attribution?: AihotAttribution
}

export interface AihotDailiesResponse {
  schemaVersion: 1
  count: number
  items: AihotDailyEntry[]
}

export interface AihotDailyContentLinks {
  aihot: string | null
  original: string
}

export interface AihotDailySectionItem {
  title: string
  summary: string
  source: AihotSource
  links: AihotDailyContentLinks
  attribution?: AihotAttribution
}

export interface AihotDailySection {
  label: string
  items: AihotDailySectionItem[]
}

export interface AihotDailyFlash {
  title: string
  source: AihotSource
  links: AihotDailyContentLinks
  publishedAt: string
  attribution?: AihotAttribution
}

export interface AihotDailyLead {
  title: string
  leadParagraph: string
}

export interface AihotDailyReport {
  date: string
  generatedAt: string
  windowStart: string
  windowEnd: string
  links: { aihot: string }
  attribution?: AihotAttribution
  lead: AihotDailyLead | null
  sections: AihotDailySection[]
  flashes: AihotDailyFlash[]
}

export interface AihotDailyResponse {
  schemaVersion: 1
  report: AihotDailyReport
}

/** 精选集字段集：default=完整，minimal=约省 4 倍体积 */
export type AihotSelectedFields = 'default' | 'minimal'

export interface AihotSelectedSnapshot {
  schemaVersion: 1
  asOf: string
  fields: AihotSelectedFields
  /** 账本水位，保存后供 /api/v1/selected/changes 使用 */
  cursor: string
  count: number
  hasMore: boolean
  nextPage: string | null
  /** fields=default 为 AihotItem[]，minimal 为 AihotItemMinimal[] */
  items: AihotItem[] | AihotItemMinimal[]
}

export interface AihotSelectedRemove {
  op: 'remove'
  changedAt: string
  id: string
}

export interface AihotSelectedUpsert {
  op: 'upsert'
  changedAt: string
  item: AihotItem
}

export interface AihotSelectedUpsertMinimal {
  op: 'upsert'
  changedAt: string
  item: AihotItemMinimal
}

export type AihotSelectedChange =
  | AihotSelectedRemove
  | AihotSelectedUpsert
  | AihotSelectedUpsertMinimal

export interface AihotSelectedChanges {
  schemaVersion: 1
  fields: AihotSelectedFields
  cursor: string
  count: number
  hasMore: boolean
  changes: AihotSelectedChange[]
}
