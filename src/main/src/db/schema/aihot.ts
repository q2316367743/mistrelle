/**
 * AIHOT 精选集 Drizzle schema（表结构与索引元数据）。
 *
 * 约定：
 * - data 存完整 AihotItem JSON，仅供渲染；title/category/discovered_at/published_at/search_text
 *   是从 data 提取的可筛选/可排序标量列（避免整行 JSON 参与筛选）。
 * - search_text 为小写拼接的 title+originalTitle+summary，供 LIKE 子串搜索（q>=2 字符）。
 * - timeline 排序/筛选基准：by='timeline' 用 discovered_at，by='published' 用 coalesce(published_at, discovered_at)。
 */
import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const aihotItems = sqliteTable(
  'aihot_item',
  {
    id: text('id').primaryKey(),
    title: text('title'),
    category: text('category'),
    discoveredAt: text('discovered_at'),
    publishedAt: text('published_at'),
    searchText: text('search_text'),
    data: text('data').notNull()
  },
  (t) => [
    index('idx_aihot_category').on(t.category),
    index('idx_aihot_discovered').on(t.discoveredAt),
    index('idx_aihot_published').on(t.publishedAt)
  ]
)

/** 账本元数据（schemaVersion / fields / cursor 水位 / syncedAt），键值对存储 */
export const aihotMeta = sqliteTable('aihot_meta', {
  key: text('key').primaryKey(),
  value: text('value')
})
