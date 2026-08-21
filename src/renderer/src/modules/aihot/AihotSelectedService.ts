// ==========================================
//  AIHOT 精选集 SQLite 存储 + 增量同步
//  接入文档约定（https://aihot.virxact.com/agent?tab=api）：
//  - 长期维护全部精选：snapshot 一次性引导（分页拉全量，保留第一页 cursor）
//    + changes 永续增量（先应用页面再推进 cursor；409 snapshot_required 重引导）
//  - fields=default（含 summary）；游标不按时钟过期，落盘跨启动复用
//
//  存储层：数据存于 SQLite（~/.mistrelle/db/mistrelle.db，main 进程 DAO），
//  渲染侧不再持有全量数组；去重靠主键 id + INSERT OR REPLACE，
//  筛选 / 排序 / 分页在 SQL 内完成。详见 docs/data/01-sqlite-storage.md
// ==========================================
import {
  aihotApiV1SelectedChanges,
  aihotApiV1SelectedSnapshot,
  type AihotItem,
  type AihotItemMinimal
} from '@/modules/api/aihot'
import { aihotErrorStatus, aihotNotifyError } from './AihotRequestError'

/** fields=default 契约下的字段集判别（防御服务端异常返回 minimal） */
const isFullItem = (item: AihotItem | AihotItemMinimal): item is AihotItem =>
  'originalTitle' in item

/** AihotItem → DB 行载荷：data 存完整 JSON，search_text 供 SQL 子串搜索 */
const toDbItem = (item: AihotItem): AihotDbItemInput => ({
  id: item.id,
  title: item.title,
  category: item.category,
  discoveredAt: item.discoveredAt,
  publishedAt: item.publishedAt,
  searchText: `${item.title}\n${item.originalTitle ?? ''}\n${item.summary ?? ''}`.toLowerCase(),
  data: JSON.stringify(item)
})

/** 本地筛选查询入参（由组合式函数传入） */
export interface AihotListQuery {
  keyword: string
  category: string
  timeWindow: '24h' | '7d' | 'all'
  by: AihotListBy
}

const WINDOW_MS: Record<'24h' | '7d', number> = {
  '24h': 24 * 3600 * 1000,
  '7d': 7 * 24 * 3600 * 1000
}

/** 时间窗下界（ISO）：all 返回 null（不过滤），语义与服务端 items 窗口对齐 */
const cutoffIso = (tw: AihotListQuery['timeWindow']): string | null =>
  tw === 'all' ? null : new Date(Date.now() - WINDOW_MS[tw]).toISOString()

/**
 * 分页查询精选列表（筛选 / 排序 / 分页在 SQL 内完成，不加载全量）。
 * items 由 DB 行的 data JSON 还原为 AihotItem
 */
export const listAihotItems = async (
  query: AihotListQuery,
  limit: number,
  offset: number
): Promise<{ items: AihotItem[]; total: number }> => {
  const q = query.keyword.trim().toLowerCase()
  const res = await window.preload.db.aihot.list({
    filter: {
      keyword: q.length >= 2 ? q : '',
      category: query.category,
      cutoffIso: cutoffIso(query.timeWindow),
      by: query.by
    },
    limit,
    offset
  })
  return { items: res.items.map((r) => JSON.parse(r.data) as AihotItem), total: res.total }
}

/** 读取账本元数据（schemaVersion / fields / cursor 水位 / syncedAt） */
export const getAihotMeta = async (): Promise<AihotMeta> => window.preload.db.aihot.getMeta()

/** 清空精选数据与元数据（409 重引导时由同步流程调用） */
export const clearAihotItems = async (): Promise<void> => window.preload.db.aihot.clear()

/** snapshot 引导：翻页拉全量，一次性原子写入（含第一页 cursor 作为增量水位） */
const bootstrapSnapshot = async (): Promise<void> => {
  const collected: AihotDbItemInput[] = []
  let firstCursor: string | null = null
  let page: string | undefined
  for (;;) {
    const data = await aihotApiV1SelectedSnapshot({ fields: 'default', limit: 1000, page })
    if (firstCursor === null) firstCursor = data.cursor
    // 联合元素数组显式拓宽后 filter 才能用类型守卫收窄
    const pageItems: Array<AihotItem | AihotItemMinimal> = data.items
    for (const item of pageItems) if (isFullItem(item)) collected.push(toDbItem(item))
    if (!data.hasMore || !data.nextPage) break
    page = data.nextPage
  }
  await window.preload.db.aihot.applyBatch({
    upserts: collected,
    deletes: [],
    meta: { schemaVersion: 1, fields: 'default', cursor: firstCursor, syncedAt: new Date().toISOString() }
  })
}

/** changes 增量：按文档「先应用页面再保存新 cursor」，每页一个事务原子应用（崩溃可从水位续传） */
const applyChanges = async (): Promise<void> => {
  let cursor = (await getAihotMeta()).cursor ?? ''
  for (;;) {
    const data = await aihotApiV1SelectedChanges({ cursor, limit: 100 })
    const upserts: AihotDbItemInput[] = []
    const deletes: string[] = []
    for (const change of data.changes) {
      if (change.op === 'remove') {
        deletes.push(change.id)
      } else if (isFullItem(change.item)) {
        upserts.push(toDbItem(change.item))
      }
    }
    cursor = data.cursor
    await window.preload.db.aihot.applyBatch({
      upserts,
      deletes,
      meta: { cursor, syncedAt: new Date().toISOString() }
    })
    if (!data.hasMore) break
  }
}

/** in-flight 去重：页面初始化与手动刷新并发触发时复用同一次同步 */
let syncPromise: Promise<void> | null = null

/**
 * 同步精选集（并发调用复用同一次同步）：
 * 未引导走 snapshot，已有水位走 changes；409 重置后自动重新引导一次；
 * 网络失败保留缓存原样并提示；同步完成后调用方需自行重新查询列表
 */
export const syncAihotSelected = (): Promise<void> => {
  if (syncPromise) return syncPromise
  syncPromise = (async () => {
    try {
      const meta = await getAihotMeta()
      if (meta.cursor) {
        await applyChanges()
      } else {
        await bootstrapSnapshot()
      }
    } catch (e) {
      if (aihotErrorStatus(e) === 409) {
        // 游标失效（snapshot_required）：清空缓存重新引导
        await clearAihotItems()
        try {
          await bootstrapSnapshot()
        } catch (e2) {
          aihotNotifyError('AIHOT 精选集同步失败', e2)
        }
      } else {
        aihotNotifyError('AIHOT 精选集同步失败', e)
      }
    } finally {
      syncPromise = null
    }
  })()
  return syncPromise
}
