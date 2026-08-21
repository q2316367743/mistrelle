/**
 * SQLite 领域通道常量与载荷类型（preload 桥与 main handler 共用）。
 *
 * 设计约定（见 docs/data/01-sqlite-storage.md）：
 * - 所有 SQL 与 DAO 逻辑都在 main（ipc/dbIpc.ts + db/ 下），preload 只透传类型化领域参数。
 * - 用户输入（关键词 / 分类 / 时间）一律经 DAO 绑定参数，禁止拼 SQL。
 * - 独立于 channels.ts（其已贴 500 行红线），本文件只承载 db 域。
 */
export const DbChannels = {
  aihotList: 'db:aihot:list',
  aihotApplyBatch: 'db:aihot:applyBatch',
  aihotClear: 'db:aihot:clear',
  aihotGetMeta: 'db:aihot:getMeta'
} as const

/** 排序 / 时间筛选基准 */
export type AihotListBy = 'timeline' | 'published'

/** 写入 aihot_item 的行载荷：data 为完整 AihotItem JSON，其余为提取的可筛选 / 排序标量 */
export interface AihotDbItemInput {
  id: string
  title: string | null
  category: string | null
  discoveredAt: string | null
  publishedAt: string | null
  searchText: string
  data: string
}

export interface AihotListFilter {
  /** 关键词（>=2 字符才参与匹配，对 search_text 子串） */
  keyword?: string
  /** 分类；空串 = 全部 */
  category?: string
  /** 时间窗下界（ISO 字符串）；null = 全部时间 */
  cutoffIso?: string | null
  by: AihotListBy
}

export interface AihotListParams {
  filter: AihotListFilter
  limit: number
  offset: number
}

export interface AihotListResult {
  /** data 为完整 AihotItem JSON（渲染侧 JSON.parse 还原），id 供 key 使用 */
  items: Array<{ id: string; data: string }>
  total: number
}

export interface AihotMeta {
  schemaVersion: number
  fields: 'default'
  /** 增量账本水位；null = 尚未引导 */
  cursor: string | null
  syncedAt: string | null
}

/** 一批应用（upsert + delete + meta）在一个事务内原子完成 */
export interface AihotBatch {
  upserts: AihotDbItemInput[]
  deletes: string[]
  meta: Partial<AihotMeta>
}
