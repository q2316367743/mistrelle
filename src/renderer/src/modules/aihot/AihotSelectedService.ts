// ==========================================
//  AIHOT 精选集本地缓存 + 增量同步
//  接入文档约定（https://aihot.virxact.com/agent?tab=api）：
//  - 长期维护全部精选：snapshot 一次性引导（分页拉全量，保留第一页 cursor）
//    + changes 永续增量（先应用页面再推进 cursor；409 snapshot_required 重引导）
//  - fields=default（含 summary）；游标不按时钟过期，落盘跨启动复用
// ==========================================
import { readJsonFile, writeJsonFile } from '@/utils/native'
import { getCacheAihotDir, getCacheAihotSelectedPath } from '@/global/Constant'
import {
  aihotApiV1SelectedChanges,
  aihotApiV1SelectedSnapshot,
  type AihotItem,
  type AihotItemMinimal
} from '@/modules/api/aihot'
import { aihotErrorStatus, aihotNotifyError } from './AihotRequestError'

/** 精选集本地缓存结构（~/.mistrelle/cache/aihot/selected.json） */
export interface AihotSelectedCache {
  schemaVersion: 1
  /** 快照初始化时选定的字段集，changes 增量跟随同一字段集 */
  fields: 'default'
  /** 账本水位：snapshot 第一页或最近一次 changes 返回的 cursor；null = 尚未引导 */
  cursor: string | null
  items: Array<AihotItem>
  syncedAt: string | null
}

const emptyCache = (): AihotSelectedCache => ({
  schemaVersion: 1,
  fields: 'default',
  cursor: null,
  items: [],
  syncedAt: null
})

/** fields=default 契约下的字段集判别（防御服务端异常返回 minimal） */
const isFullItem = (item: AihotItem | AihotItemMinimal): item is AihotItem =>
  'originalTitle' in item

/** 进程内缓存，避免重复读盘 */
let stateCache: AihotSelectedCache | null = null
/** in-flight 去重：页面初始化与手动刷新并发触发时复用同一次同步 */
let syncPromise: Promise<AihotSelectedCache> | null = null

/** 返回缓存视图（新引用 + items 数组拷贝，供 Vue 响应式替换） */
const readCacheView = (): AihotSelectedCache =>
  stateCache ? { ...stateCache, items: [...stateCache.items] } : emptyCache()

const persist = async (): Promise<void> => {
  if (!stateCache) return
  await window.preload.fs.mkdir(getCacheAihotDir(), true)
  await writeJsonFile(getCacheAihotSelectedPath(), stateCache)
}

/** 读取本地精选集缓存（文件不存在返回空壳，不落盘） */
export const loadAihotSelected = async (): Promise<AihotSelectedCache> => {
  if (stateCache) return readCacheView()
  const loaded = await readJsonFile<AihotSelectedCache>(getCacheAihotSelectedPath())
  stateCache = loaded ?? emptyCache()
  return readCacheView()
}

/** snapshot 引导：翻页拉全量，保留第一页 cursor 作为增量水位 */
const bootstrapSnapshot = async (): Promise<void> => {
  const collected: Array<AihotItem> = []
  let firstCursor: string | null = null
  let page: string | undefined
  for (;;) {
    const data = await aihotApiV1SelectedSnapshot({ fields: 'default', limit: 1000, page })
    if (firstCursor === null) firstCursor = data.cursor
    // 联合元素数组显式拓宽后 filter 才能用类型守卫收窄
    const pageItems: Array<AihotItem | AihotItemMinimal> = data.items
    collected.push(...pageItems.filter(isFullItem))
    if (!data.hasMore || !data.nextPage) break
    page = data.nextPage
  }
  stateCache = {
    schemaVersion: 1,
    fields: 'default',
    cursor: firstCursor,
    items: collected,
    syncedAt: new Date().toISOString()
  }
  await persist()
}

/** changes 增量：按文档「先应用页面再保存新 cursor」，每页应用后即落盘（崩溃可从水位续传） */
const applyChanges = async (): Promise<void> => {
  const map = new Map(stateCache?.items.map((item) => [item.id, item]) ?? [])
  for (;;) {
    const data = await aihotApiV1SelectedChanges({
      cursor: stateCache?.cursor ?? '',
      limit: 100
    })
    for (const change of data.changes) {
      if (change.op === 'remove') {
        map.delete(change.id)
      } else if (isFullItem(change.item)) {
        map.set(change.item.id, change.item)
      }
    }
    if (stateCache) {
      stateCache.cursor = data.cursor
      stateCache.items = Array.from(map.values())
      stateCache.syncedAt = new Date().toISOString()
    }
    await persist()
    if (!data.hasMore) break
  }
}

/**
 * 同步精选集（并发调用复用同一次同步）：
 * 未引导走 snapshot，已有水位走 changes；409 重置后自动重新引导一次；
 * 网络失败保留缓存原样并提示，始终返回当前缓存视图
 */
export const syncAihotSelected = (): Promise<AihotSelectedCache> => {
  if (syncPromise) return syncPromise
  syncPromise = (async () => {
    await loadAihotSelected()
    try {
      if (stateCache?.cursor) {
        await applyChanges()
      } else {
        await bootstrapSnapshot()
      }
    } catch (e) {
      if (aihotErrorStatus(e) === 409) {
        // 游标失效（snapshot_required）：清空缓存重新引导
        stateCache = emptyCache()
        try {
          await bootstrapSnapshot()
        } catch (e2) {
          aihotNotifyError('AIHOT 精选集同步失败', e2)
        }
      } else {
        aihotNotifyError('AIHOT 精选集同步失败', e)
      }
    } finally {
      syncPromise = null
    }
    return readCacheView()
  })()
  return syncPromise
}
