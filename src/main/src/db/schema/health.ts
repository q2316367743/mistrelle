/**
 * 模型健康检测域 Drizzle schema（可用性检测工具的检测记录）。
 *
 * 约定：
 * - 一行 = 一次检测任务，状态机 running → finished / stopped（渲染侧驱动，单任务锁在渲染层 composable）。
 * - items / logs 为结果与日志数组的 JSON 文本（渲染侧 parse 还原）；逐项完成时整行 upsert 增量累积。
 * - API 密钥只用于当次检测请求，不落库（本表无 key 列）。
 * - report 为审计报告 markdown，任务收尾时自动生成；历史里可重新生成覆盖。
 */
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type {
  HealthApiFormat,
  HealthCheckMode,
  HealthConclusion,
  HealthTaskStatus
} from '~/dbChannels'

export const modelHealths = sqliteTable(
  'model_health',
  {
    id: text('id').primaryKey(),
    /** 提供方名称快照（手动填写的检测为 null） */
    provideName: text('provide_name'),
    apiUrl: text('api_url').notNull(),
    modelId: text('model_id').notNull(),
    modelName: text('model_name'),
    format: text('format').$type<HealthApiFormat>().notNull(),
    mode: text('mode').$type<HealthCheckMode>().notNull(),
    status: text('status').$type<HealthTaskStatus>().notNull(),
    conclusion: text('conclusion').$type<HealthConclusion>().notNull(),
    items: text('items').notNull(),
    logs: text('logs').notNull(),
    report: text('report'),
    durationMs: integer('duration_ms'),
    createdAt: integer('created_at').notNull()
  },
  (t) => [index('idx_model_health_created').on(t.createdAt)]
)
