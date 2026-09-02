/**
 * 文生图领域仓储（main 进程）：Drizzle 查询层，封装 image_generate 表读写。
 *
 * - 状态机由渲染侧驱动：插入 pending → 生成结束 upsert success（补宽高）/ failed（补 error）。
 * - list 的筛选 / 排序 / 分页全部在 SQL 内完成（prompt 子串、status 精确、created_at 倒序）。
 * - 删除只删记录行，图片文件由渲染侧联动删除（与 chat 沙盒目录删除同一约定）。
 */
import { db } from '../client'
import { and, count, desc, eq, like, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { imageGenerations } from '../schema/image'
import type { ImageListFilter, ImageListResult, ImageRecordInput } from '~/ipc/dbChannels'

export function imageList(filter: ImageListFilter, limit: number, offset: number): ImageListResult {
  const conds: Array<SQL | undefined> = []
  if (filter.status) conds.push(eq(imageGenerations.status, filter.status))
  if (filter.keyword && filter.keyword.length >= 2) {
    conds.push(like(imageGenerations.prompt, `%${filter.keyword}%`))
  }
  const where = conds.length ? and(...conds) : undefined

  const items = db()
    .select()
    .from(imageGenerations)
    .where(where)
    .orderBy(desc(imageGenerations.createdAt))
    .limit(limit)
    .offset(offset)
    .all()
  const total = db().select({ c: count() }).from(imageGenerations).where(where).get()?.c ?? 0
  return { items, total }
}

const upsertSet = {
  prompt: sql`excluded.prompt`,
  model: sql`excluded.model`,
  styleName: sql`excluded.style_name`,
  size: sql`excluded.size`,
  path: sql`excluded.path`,
  width: sql`excluded.width`,
  height: sql`excluded.height`,
  status: sql`excluded.status`,
  error: sql`excluded.error`,
  taskId: sql`excluded.task_id`,
  pollMaxAt: sql`excluded.poll_max_at`,
  taskTerminal: sql`excluded.task_terminal`,
  createdAt: sql`excluded.created_at`
}

export function imageUpsert(record: ImageRecordInput): void {
  db()
    .insert(imageGenerations)
    .values(record)
    .onConflictDoUpdate({ target: imageGenerations.id, set: upsertSet })
    .run()
}

export function imageDelete(id: string): void {
  db().delete(imageGenerations).where(eq(imageGenerations.id, id)).run()
}
