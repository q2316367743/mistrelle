/**
 * AIHOT 领域仓储（main 进程）：Drizzle 查询层，封装 aihot_item / aihot_meta 表读写。
 *
 * - 去重靠 aihot_item 主键 id + onConflictDoUpdate（=INSERT OR REPLACE），无需整表遍历。
 * - list 的筛选 / 排序 / 分页全部在 SQL 内完成（category 精确、search_text 子串、
 *   timeline/published 时间下界、时间倒序 LIMIT/OFFSET），渲染进程不持有全量数组。
 * - applyBatch 将「delete + upsert + meta 水位推进」在单个事务内原子完成，崩溃可从水位续传。
 */
import { db } from '../client'
import { and, count, desc, eq, gte, inArray, like, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { aihotItems, aihotMeta } from '../schema/aihot'
import type {
  AihotBatch,
  AihotDbItemInput,
  AihotListBy,
  AihotListFilter,
  AihotListResult,
  AihotMeta
} from '~/modules/db/dbChannels'

/** 排序 / 时间下界用的基准列：timeline 用 discovered_at，published 用 coalesce(published_at, discovered_at) */
const timeKey = (by: AihotListBy): SQL =>
  by === 'published'
    ? sql`coalesce(${aihotItems.publishedAt}, ${aihotItems.discoveredAt})`
    : sql`${aihotItems.discoveredAt}`

/** 时间窗下界（ISO 字符串）转 SQL 表达式，供 WHERE/ORDER 复用 */
export function aiHotList(filter: AihotListFilter, limit: number, offset: number): AihotListResult {
  const key = timeKey(filter.by)
  const conds: Array<SQL | undefined> = []
  if (filter.category) conds.push(eq(aihotItems.category, filter.category))
  if (filter.keyword && filter.keyword.length >= 2) {
    conds.push(like(aihotItems.searchText, `%${filter.keyword.toLowerCase()}%`))
  }
  if (filter.cutoffIso) conds.push(gte(key, filter.cutoffIso))
  const where = conds.length ? and(...conds) : undefined

  const rows = db()
    .select({ id: aihotItems.id, data: aihotItems.data, read: aihotItems.read })
    .from(aihotItems)
    .where(where)
    .orderBy(desc(key))
    .limit(limit)
    .offset(offset)
    .all()
  const total = db().select({ c: count() }).from(aihotItems).where(where).get()?.c ?? 0
  return { items: rows.map((r) => ({ id: r.id, data: r.data, read: r.read === 1 })), total }
}

const toRow = (it: AihotDbItemInput) => ({
  id: it.id,
  title: it.title,
  category: it.category,
  discoveredAt: it.discoveredAt,
  publishedAt: it.publishedAt,
  searchText: it.searchText,
  data: it.data
})

const upsertSet = {
  title: sql`excluded.title`,
  category: sql`excluded.category`,
  discoveredAt: sql`excluded.discovered_at`,
  publishedAt: sql`excluded.published_at`,
  searchText: sql`excluded.search_text`,
  data: sql`excluded.data`
}

const metaEntries = (meta: Partial<AihotMeta>): Array<{ key: string; value: string }> => {
  const entries: Array<{ key: string; value: string }> = []
  if (meta.schemaVersion !== undefined) entries.push({ key: 'schemaVersion', value: String(meta.schemaVersion) })
  if (meta.fields !== undefined) entries.push({ key: 'fields', value: meta.fields })
  if (meta.cursor !== undefined) entries.push({ key: 'cursor', value: meta.cursor ?? '' })
  if (meta.syncedAt !== undefined) entries.push({ key: 'syncedAt', value: meta.syncedAt ?? '' })
  return entries
}

/** 应用一批变更（delete + upsert + meta 水位），单事务原子完成 */
export function aiHotApplyBatch(batch: AihotBatch): void {
  db().transaction((tx) => {
    if (batch.deletes.length) {
      tx.delete(aihotItems).where(inArray(aihotItems.id, batch.deletes)).run()
    }
    if (batch.upserts.length) {
      tx.insert(aihotItems)
        .values(batch.upserts.map(toRow))
        .onConflictDoUpdate({ target: aihotItems.id, set: upsertSet })
        .run()
    }
    const entries = metaEntries(batch.meta)
    if (entries.length) {
      tx.insert(aihotMeta)
        .values(entries)
        .onConflictDoUpdate({ target: aihotMeta.key, set: { value: sql`excluded.value` } })
        .run()
    }
  })
}

/** 标记单条为已读（点击打开条目时调用；只更新 read 列，不影响同步水位与筛选） */
export function aiHotMarkRead(id: string): void {
  db().update(aihotItems).set({ read: 1 }).where(eq(aihotItems.id, id)).run()
}

/** 清空精选数据与元数据（409 重引导时使用） */
export function aiHotClear(): void {
  db().delete(aihotItems).run()
  db().delete(aihotMeta).run()
}

/** 读取账本元数据（缺省返回空壳，不预写） */
export function aiHotGetMeta(): AihotMeta {
  const rows = db().select({ key: aihotMeta.key, value: aihotMeta.value }).from(aihotMeta).all()
  const m = new Map(rows.map((r) => [r.key, r.value ?? '']))
  return {
    schemaVersion: Number(m.get('schemaVersion') ?? 1),
    fields: 'default',
    cursor: m.get('cursor') || null,
    syncedAt: m.get('syncedAt') || null
  }
}
