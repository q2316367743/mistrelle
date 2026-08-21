// ==========================================
//  资讯 tab 本地数据源（精选集本地缓存 + 本地筛选）
//  selected 模式：打开即渲染本地缓存，后台增量同步；
//  筛选/搜索/排序/分片全部本地计算，无网络请求
// ==========================================
import dayjs from 'dayjs'
import type { AihotItem } from '@/modules/api/aihot'
import { loadAihotSelected, syncAihotSelected, type AihotSelectedCache } from '@/modules/aihot'
import { aihotTimelineKey } from './aihot-page-utils'
import type { Ref } from 'vue'

/** 本地模式的窗口选项（含全部时间：本地缓存才有全量历史） */
export type AihotLocalWindow = '24h' | '7d' | 'all'

const LOCAL_PAGE_SIZE = 30

/** 自动同步节流间隔：距上次成功同步小于该值时跳过自动增量（手动刷新不受限） */
const AUTO_SYNC_INTERVAL = 5 * 60 * 1000

export interface AihotLocalFilter {
  keyword: Ref<string>
  category: Ref<string>
  timeWindow: Ref<AihotLocalWindow>
  by: Ref<'timeline' | 'published'>
}

export const useAihotSelectedItems = (filter: AihotLocalFilter) => {
  const { keyword, category, timeWindow, by } = filter

  const cache = ref<AihotSelectedCache | null>(null)
  const syncing = ref(false)
  /** 仅手动刷新时置 true（驱动刷新按钮转圈；自动同步静默不打扰浏览） */
  const manualSyncing = ref(false)

  /** 本地分片游标（展示条数上限） */
  const shown = ref(LOCAL_PAGE_SIZE)

  const ready = computed(() => cache.value !== null)
  const syncedAt = computed(() => cache.value?.syncedAt ?? null)

  /** 过滤 + 按时间倒序（窗口按基准时间戳计算，与服务端 items 语义对齐） */
  const filtered = computed<Array<AihotItem>>(() => {
    const items = cache.value?.items ?? []
    const q = keyword.value.trim().toLowerCase()
    const windowMs =
      timeWindow.value === '24h'
        ? 24 * 3600 * 1000
        : timeWindow.value === '7d'
          ? 7 * 24 * 3600 * 1000
          : null
    const now = Date.now()
    return items
      .filter((item) => {
        if (category.value && item.category !== category.value) return false
        if (
          windowMs !== null &&
          now - dayjs(aihotTimelineKey(item, by.value)).valueOf() > windowMs
        ) {
          return false
        }
        if (q.length >= 2) {
          const haystack =
            `${item.title}\n${item.originalTitle ?? ''}\n${item.summary ?? ''}`.toLowerCase()
          if (!haystack.includes(q)) return false
        }
        return true
      })
      .sort(
        (a, b) =>
          dayjs(aihotTimelineKey(b, by.value)).valueOf() -
          dayjs(aihotTimelineKey(a, by.value)).valueOf()
      )
  })

  /** 当前分片可见条目 */
  const visible = computed(() => filtered.value.slice(0, shown.value))
  const hasMore = computed(() => shown.value < filtered.value.length)

  /** 初始化：读本地缓存即时渲染，随后静默增量同步（5 分钟内已同步过则跳过） */
  const init = async () => {
    if (!cache.value) {
      cache.value = await loadAihotSelected()
    }
    const last = cache.value.syncedAt ? dayjs(cache.value.syncedAt).valueOf() : 0
    if (Date.now() - last < AUTO_SYNC_INTERVAL) return
    sync()
  }

  const sync = async (manual = false) => {
    // 手动触达时已有同步在途：置位转圈后跟随，由在途调用的 finally 统一复位
    if (manual) manualSyncing.value = true
    if (syncing.value) return
    syncing.value = true
    try {
      cache.value = await syncAihotSelected()
    } finally {
      syncing.value = false
      manualSyncing.value = false
    }
  }

  /** 筛选变化后回到首个分片 */
  const resetShown = () => {
    shown.value = LOCAL_PAGE_SIZE
  }

  const more = () => {
    shown.value += LOCAL_PAGE_SIZE
  }

  return {
    ready,
    syncing,
    manualSyncing,
    syncedAt,
    filtered,
    visible,
    hasMore,
    init,
    sync,
    resetShown,
    more
  }
}
