/**
 * 模型对比检测领域仓储（main 进程）：封装 compare_question（题库）与 model_compare（对比记录）读写。
 *
 * - 题库：逐条 upsert / delete + replaceAll（恢复默认，单事务全删全插）；list 按 order_index 升序。
 * - 记录：list 仅分页（created_at 倒序）；models / results / logs 为 JSON 文本，本层原样透传由渲染侧解析；
 *   状态机由渲染侧驱动（插入 running → 逐阶段整行 upsert 累积 → 收尾 finished / stopped）。
 */
import { db } from '../client'
import { count, desc, eq, sql } from 'drizzle-orm'
import { compareQuestions, modelCompares } from '../schema/compare'
import type {
  CompareListResult,
  CompareQuestionInput,
  CompareRecordInput
} from '~/dbChannels'

// ── 题库 ─────────────────

export function compareQuestionList(): CompareQuestionInput[] {
  return db()
    .select()
    .from(compareQuestions)
    .orderBy(compareQuestions.orderIndex)
    .all()
    .map((row) => ({
      ...row,
      answerKeys: parseKeys(row.answerKeys)
    }))
}

const parseKeys = (text: string): string[] => {
  try {
    const parsed = JSON.parse(text) as unknown
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}

export function compareQuestionUpsert(question: CompareQuestionInput): void {
  db()
    .insert(compareQuestions)
    .values({
      ...question,
      answerKeys: JSON.stringify(question.answerKeys)
    })
    .onConflictDoUpdate({
      target: compareQuestions.key,
      set: {
        tag: sql`excluded.tag`,
        orderIndex: sql`excluded.order_index`,
        enable: sql`excluded.enable`,
        question: sql`excluded.question`,
        reference: sql`excluded.reference`,
        answerKeys: sql`excluded.answer_keys`,
        pattern: sql`excluded.pattern`,
        note: sql`excluded.note`
      }
    })
    .run()
}

export function compareQuestionDelete(key: string): void {
  db().delete(compareQuestions).where(eq(compareQuestions.key, key)).run()
}

/** 全量替换题库（恢复默认：单事务清空 + 批量插入） */
export function compareQuestionReplaceAll(questions: CompareQuestionInput[]): void {
  db().transaction((tx) => {
    tx.delete(compareQuestions).run()
    for (const question of questions) {
      tx.insert(compareQuestions)
        .values({ ...question, answerKeys: JSON.stringify(question.answerKeys) })
        .run()
    }
  })
}

// ── 对比记录 ─────────────────

export function compareRecordList(limit: number, offset: number): CompareListResult {
  const items = db()
    .select()
    .from(modelCompares)
    .orderBy(desc(modelCompares.createdAt))
    .limit(limit)
    .offset(offset)
    .all()
  const total = db().select({ c: count() }).from(modelCompares).get()?.c ?? 0
  return { items, total }
}

export function compareRecordUpsert(record: CompareRecordInput): void {
  db()
    .insert(modelCompares)
    .values(record)
    .onConflictDoUpdate({
      target: modelCompares.id,
      set: {
        status: sql`excluded.status`,
        execMode: sql`excluded.exec_mode`,
        speedRuns: sql`excluded.speed_runs`,
        consistencyCount: sql`excluded.consistency_count`,
        models: sql`excluded.models`,
        results: sql`excluded.results`,
        logs: sql`excluded.logs`,
        durationMs: sql`excluded.duration_ms`,
        reportPath: sql`excluded.report_path`,
        createdAt: sql`excluded.created_at`
      }
    })
    .run()
}

export function compareRecordDelete(id: string): void {
  db().delete(modelCompares).where(eq(modelCompares.id, id)).run()
}