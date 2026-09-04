// ==========================================
//  模型对比检测：数据持久化层。
//  - 题库 / 对比记录存 SQLite（compare_question / model_compare 表，用户拍板防 json 手改格式错误并支持历史分页）；
//  - md 审计报告是用户手动导出产物：composable 的 exportReport 弹 dialog.save 让用户自选路径，程序不落固定目录；
//  - 无偏好持久化（config.json 已删，进页面表单恒用默认值）。
// ==========================================
import type {
  CompareLogEntry,
  CompareModelResult,
  CompareModelSnapshot,
  CompareRecord
} from './compare-types'

// ── 记录行 ↔ 结构化转换 ─────────────────

/** CompareRecord → model_compare 行（标量列 + models/results/logs JSON 文本；密钥在结构化目标中已剥离） */
export const recordToRow = (record: CompareRecord): CompareRecordInput => ({
  id: record.id,
  status: record.status,
  execMode: record.config.execMode,
  speedRuns: record.config.speedRuns,
  consistencyCount: record.config.consistencyCount,
  models: JSON.stringify(record.config.models),
  results: JSON.stringify(record.results),
  logs: JSON.stringify(record.logs),
  durationMs: record.durationMs,
  reportPath: null,
  createdAt: record.createdAt
})

/** model_compare 行 → CompareRecord（JSON 列 parse；坏数据回退空数组） */
export const rowToRecord = (row: CompareRecordInput): CompareRecord => {
  const parse = <T>(text: string, fallback: T): T => {
    try {
      const parsed = JSON.parse(text) as unknown
      return (parsed as T) ?? fallback
    } catch {
      return fallback
    }
  }
  return {
    id: row.id,
    createdAt: row.createdAt,
    status: row.status,
    config: {
      execMode: row.execMode,
      speedRuns: row.speedRuns,
      consistencyCount: row.consistencyCount,
      models: parse(row.models, [] as CompareModelSnapshot[])
    },
    results: parse(row.results, [] as CompareModelResult[]),
    logs: parse(row.logs, [] as CompareLogEntry[]),
    durationMs: row.durationMs
  }
}

// ── 记录读写（db 桥薄封装） ─────────────────

/** 任务整行 upsert 落库（运行中防抖覆写 / 收尾强制落盘共用） */
export const saveRecord = async (record: CompareRecord): Promise<void> => {
  await window.preload.db.compare.record.upsert(recordToRow(record))
}

/** 删除对比记录（仅 DB 行；用户手动导出的报告文件由用户自行管理，不连带删除） */
export const removeRecord = async (record: CompareRecord): Promise<void> => {
  await window.preload.db.compare.record.delete(record.id)
}