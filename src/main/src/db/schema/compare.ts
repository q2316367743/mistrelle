/**
 * 模型对比检测域 Drizzle schema（题库 + 对比任务记录）。
 *
 * 约定：
 * - compare_question：一行 = 一道题（题库外置 DB，页面抽屉 / 编辑弹窗即时增删改，不再用 json 文件防手改格式错误）；
 *   key 为主键（种子固定 key / custom-{ts}），order_index 为 SQL 保留字 order 的规避命名，list 按 order_index 升序。
 * - model_compare：一行 = 一次对比任务，状态机 running → finished / stopped（渲染侧驱动，单任务锁在渲染层 composable）。
 *   models / results / logs 为数组 JSON 文本（渲染侧 parse 还原）；逐阶段完成时整行 upsert 增量累积（防抖在渲染层）。
 * - md 审计报告是用户手动导出产物（dialog.save 自选路径，见 useModelCompare.exportReport），不自动落盘；
 *   report_path 列为历史遗留（保留兼容，不再写入）。
 * - API 密钥只用于当次检测请求，不落库（本域无 key 列）。
 */
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { CompareExecMode, CompareTaskStatus } from '~/modules/db/dbChannels'

export const compareQuestions = sqliteTable('compare_question', {
  key: text('key').primaryKey(),
  tag: text('tag').notNull(),
  orderIndex: integer('order_index').notNull(),
  enable: integer('enable', { mode: 'boolean' }).notNull(),
  question: text('question').notNull(),
  reference: text('reference').notNull(),
  /** 判分关键词数组的 JSON 文本（渲染侧 parse） */
  answerKeys: text('answer_keys').notNull(),
  pattern: text('pattern'),
  note: text('note')
})

export const modelCompares = sqliteTable(
  'model_compare',
  {
    id: text('id').primaryKey(),
    status: text('status').$type<CompareTaskStatus>().notNull(),
    execMode: text('exec_mode').$type<CompareExecMode>().notNull(),
    speedRuns: integer('speed_runs').notNull(),
    consistencyCount: integer('consistency_count').notNull(),
    /** 参与模型快照数组（CompareModelSnapshot[]）的 JSON 文本 */
    models: text('models').notNull(),
    /** 各模型检测结果数组（CompareModelResult[]）的 JSON 文本 */
    results: text('results').notNull(),
    /** 执行日志数组（CompareLogEntry[]）的 JSON 文本 */
    logs: text('logs').notNull(),
    durationMs: integer('duration_ms'),
    /** md 审计报告绝对路径（收尾时生成；生成失败为 null） */
    reportPath: text('report_path'),
    createdAt: integer('created_at').notNull()
  },
  (t) => [index('idx_model_compare_created').on(t.createdAt)]
)
