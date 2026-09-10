/**
 * 文生图领域仓储（main 进程）：Drizzle 查询层，封装 image_generate 表读写。
 *
 * - 状态机由主进程 ImageService 驱动：插入 pending → 生成结束 upsert success（补宽高）/ failed（补 error）。
 * - list 的筛选 / 排序 / 分页全部在 SQL 内完成（prompt 子串、status 精确、created_at 倒序）。
 * - 删除只删记录行，图片文件由 ImageService 联动删除。
 */
import { db } from '../client'
import { and, count, desc, eq, like, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { imageGenerations } from '../schema/image'
import type {
  ImageItem,
  ImageListFilter,
  ImageListResult,
  ImageRecordInput
} from '~/modules/db/dbChannels'

const isImageItem = (value: unknown): value is ImageItem =>
  typeof value === 'object' && value !== null && typeof (value as { path?: unknown }).path === 'string'

/** 行 → 载荷：images JSON 还原为数组；旧数据 / 脏数据由 path 兜底单元素 */
function toRecord(row: typeof imageGenerations.$inferSelect): ImageRecordInput {
  let images: ImageItem[] = []
  if (row.images) {
    try {
      const parsed: unknown = JSON.parse(row.images)
      if (Array.isArray(parsed)) images = parsed.filter(isImageItem)
    } catch {
      // JSON 损坏时走 path 兜底
    }
  }
  if (!images.length && row.path) {
    images = [{ path: row.path, width: row.width, height: row.height }]
  }
  return { ...row, images }
}

export function imageList(filter: ImageListFilter, limit: number, offset: number): ImageListResult {
  const conds: Array<SQL | undefined> = []
  if (filter.status) conds.push(eq(imageGenerations.status, filter.status))
  if (filter.keyword && filter.keyword.length >= 2) {
    conds.push(like(imageGenerations.prompt, `%${filter.keyword}%`))
  }
  const where = conds.length ? and(...conds) : undefined

  const rows = db()
    .select()
    .from(imageGenerations)
    .where(where)
    .orderBy(desc(imageGenerations.createdAt))
    .limit(limit)
    .offset(offset)
    .all()
  const total = db().select({ c: count() }).from(imageGenerations).where(where).get()?.c ?? 0
  return { items: rows.map(toRecord), total }
}

const upsertSet = {
  prompt: sql`excluded.prompt`,
  model: sql`excluded.model`,
  styleName: sql`excluded.style_name`,
  size: sql`excluded.size`,
  path: sql`excluded.path`,
  width: sql`excluded.width`,
  height: sql`excluded.height`,
  images: sql`excluded.images`,
  status: sql`excluded.status`,
  error: sql`excluded.error`,
  taskId: sql`excluded.task_id`,
  pollMaxAt: sql`excluded.poll_max_at`,
  taskTerminal: sql`excluded.task_terminal`,
  createdAt: sql`excluded.created_at`
}

export function imageGet(id: string): ImageRecordInput | null {
  const row = db().select().from(imageGenerations).where(eq(imageGenerations.id, id)).get()
  return row ? toRecord(row) : null
}

export function imageUpsert(record: ImageRecordInput): void {
  db()
    .insert(imageGenerations)
    .values({ ...record, images: JSON.stringify(record.images ?? []) })
    .onConflictDoUpdate({ target: imageGenerations.id, set: upsertSet })
    .run()
}

export function imageDelete(id: string): void {
  db().delete(imageGenerations).where(eq(imageGenerations.id, id)).run()
}
