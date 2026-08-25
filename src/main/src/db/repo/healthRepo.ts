/**
 * 模型健康检测领域仓储（main 进程）：封装 model_health 表读写。
 *
 * - 状态机由渲染侧驱动：插入 running → 逐项完成整行 upsert 累积 → 收尾 finished / stopped。
 * - list 仅分页（created_at 倒序）；items / logs 为 JSON 文本，本层原样透传由渲染侧解析。
 */
import { db } from '../client'
import { count, desc, eq, sql } from 'drizzle-orm'
import { modelHealths } from '../schema/health'
import type { HealthListResult, HealthRecordInput } from '~/dbChannels'

export function healthList(limit: number, offset: number): HealthListResult {
  const items = db()
    .select()
    .from(modelHealths)
    .orderBy(desc(modelHealths.createdAt))
    .limit(limit)
    .offset(offset)
    .all()
  const total = db().select({ c: count() }).from(modelHealths).get()?.c ?? 0
  return { items, total }
}

const upsertSet = {
  provideName: sql`excluded.provide_name`,
  apiUrl: sql`excluded.api_url`,
  modelId: sql`excluded.model_id`,
  modelName: sql`excluded.model_name`,
  format: sql`excluded.format`,
  mode: sql`excluded.mode`,
  status: sql`excluded.status`,
  conclusion: sql`excluded.conclusion`,
  items: sql`excluded.items`,
  logs: sql`excluded.logs`,
  report: sql`excluded.report`,
  durationMs: sql`excluded.duration_ms`,
  createdAt: sql`excluded.created_at`
}

export function healthUpsert(record: HealthRecordInput): void {
  db()
    .insert(modelHealths)
    .values(record)
    .onConflictDoUpdate({ target: modelHealths.id, set: upsertSet })
    .run()
}

export function healthDelete(id: string): void {
  db().delete(modelHealths).where(eq(modelHealths.id, id)).run()
}
