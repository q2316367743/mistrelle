/**
 * window.preload.db 契约：SQLite 领域仓储桥。
 * 与 main 的 dbIpc.ts / db/ 仓储层对应；所有 SQL 逻辑在 main，本侧只传类型化领域参数。
 */

/** 排序 / 时间筛选基准 */
declare type AihotListBy = 'timeline' | 'published'

/** 写入 aihot_item 的行载荷：data 为完整 AihotItem JSON，其余为提取的可筛选 / 排序标量 */
declare interface AihotDbItemInput {
  id: string
  title: string | null
  category: string | null
  discoveredAt: string | null
  publishedAt: string | null
  searchText: string
  data: string
}

declare interface AihotListFilter {
  keyword?: string
  category?: string
  cutoffIso?: string | null
  by: AihotListBy
}

declare interface AihotListParams {
  filter: AihotListFilter
  limit: number
  offset: number
}

declare interface AihotListResult {
  items: Array<{ id: string; data: string }>
  total: number
}

declare interface AihotMeta {
  schemaVersion: number
  fields: 'default'
  cursor: string | null
  syncedAt: string | null
}

declare interface AihotBatch {
  upserts: AihotDbItemInput[]
  deletes: string[]
  meta: Partial<AihotMeta>
}

declare interface AihotDbApi {
  list: (params: AihotListParams) => Promise<AihotListResult>
  applyBatch: (batch: AihotBatch) => Promise<void>
  clear: () => Promise<void>
  getMeta: () => Promise<AihotMeta>
}

/** chat 表行载荷（侧栏列表项） */
declare interface ChatItemInput {
  id: string
  name: string
  top: boolean
  workspace: string
  projectId?: string
  taskId?: string
  type?: string
  createdAt: number
  updatedAt: number
}

/** 列表行（top 为 0/1 整数，渲染侧转 boolean） */
declare interface ChatItemRow {
  id: string
  name: string
  top: number
  workspace: string
  projectId: string | null
  taskId: string | null
  type: string | null
  createdAt: number
  updatedAt: number
}

declare interface ChatContentResult {
  data: string | null
  updatedTime: number | null
}

declare interface ChatDbApi {
  list: () => Promise<ChatItemRow[]>
  upsertItem: (item: ChatItemInput) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  getContent: (chatId: string) => Promise<ChatContentResult>
  setContent: (chatId: string, data: string, updatedTime: number) => Promise<void>
  getSub: (chatId: string, subId: string) => Promise<string | null>
  setSub: (chatId: string, subId: string, data: string) => Promise<void>
  getStamp: (chatId: string) => Promise<number | null>
}

declare interface DbApi {
  aihot: AihotDbApi
  chat: ChatDbApi
}
