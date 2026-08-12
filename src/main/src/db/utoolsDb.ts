/**
 * utools db 语义兼容层（lmdb 实现，简化版）。
 *
 * 与 utools 的差异（已确认裁剪）：
 * - 无 _rev / 无冲突检测：put 直接覆盖，put 传入的 _rev 字段被忽略
 * - 无附件：postAttachment / getAttachment / getAttachmentType 已删除
 * - 文档形态统一 { _id, value }；put 时除 _id / _rev 外的字段原样保留
 *
 * renderer 侧依赖的精确契约（DbStorageUtil）：
 * - get(id) → { _id, value } | null
 * - put({ _id, value }) → { ok, id }
 * - allDocs(string 前缀 | string[] 精确) → [{ _id, value }]
 * - remove(id) → { ok, id }
 */
import { homedir } from 'node:os'
import { join } from 'node:path'
import { open, type Database } from 'lmdb'
import type { DbDoc, DbPutResult, DbRemoveResult } from '~/channels'

const DB_DIR = join(homedir(), '.mistrelle', 'db')

class UtoolsDb {
  private db: Database<Record<string, unknown>, string>

  constructor() {
    this.db = open({ path: DB_DIR, encoding: 'json' })
  }

  get<T = unknown>(id: string): DbDoc<T> | null {
    const doc = this.db.get(id)
    if (!doc) return null
    return { _id: id, ...doc } as DbDoc<T>
  }

  put(doc: Record<string, unknown> & { _id: string }): DbPutResult {
    const { _id, _rev, ...rest } = doc
    if (!_id) return { ok: false, id: '', error: true, message: '缺少 _id' }
    this.db.put(_id, rest)
    return { ok: true, id: _id }
  }

  remove(idOrDoc: string | Record<string, unknown>): DbRemoveResult {
    const id = typeof idOrDoc === 'string' ? idOrDoc : (idOrDoc._id as string)
    if (!id) return { ok: false, id: '', error: true, message: '缺少 _id' }
    this.db.remove(id)
    return { ok: true, id }
  }

  allDocs<T = unknown>(key?: string | string[]): DbDoc<T>[] {
    if (Array.isArray(key)) {
      return key
        .map((id) => this.get<T>(id))
        .filter((doc): doc is DbDoc<T> => doc !== null)
    }
    if (typeof key === 'string' && key) {
      const docs: DbDoc<T>[] = []
      // 前缀匹配：start = key，end = key + '\uffff'（字符串最大字符）
      for (const { key: id, value } of this.db.getRange({ start: key, end: `${key}\uffff` })) {
        docs.push({ _id: id, ...(value as object) } as DbDoc<T>)
      }
      return docs
    }
    // 无 key：全量
    const docs: DbDoc<T>[] = []
    for (const { key: id, value } of this.db.getRange()) {
      docs.push({ _id: id, ...(value as object) } as DbDoc<T>)
    }
    return docs
  }

  bulkDocs(docs: Array<Record<string, unknown> & { _id: string }>): DbPutResult[] {
    return docs.map((doc) => this.put(doc))
  }

  close(): void {
    this.db.close()
  }
}

/** 单例：main 进程全局共享一个 lmdb 实例 */
export const utoolsDb = new UtoolsDb()
