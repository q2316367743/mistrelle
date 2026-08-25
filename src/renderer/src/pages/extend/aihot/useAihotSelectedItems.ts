// ==========================================
//  资讯 tab 本地数据源（精选集 SQLite 分页 + 后台增量同步）
//  selected 模式：打开即查询 DB 分页渲染，后台增量同步；筛选 / 搜索 / 排序 / 分页在 SQL 内完成，不持有全量数组
// ==========================================
import dayjs from 'dayjs'
import {
  getAihotMeta,
  listAihotItems,
  markAihotItemRead,
  syncAihotSelected,
  type AihotItemView,
  type AihotListQuery
} from '@/modules/aihot'
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
  by: Ref<AihotListBy>
}

export const useAihotSelectedItems = (filter: AihotLocalFilter) => {
  const { keyword, category, timeWindow, by } = filter

  /** 当前已加载的多页条目（前 offset 条 + 尾部续页），read 为本地已读标记 */
  const list = ref<AihotItemView[]>([])
  /** 匹配筛选的总条数（状态栏展示 / hasMore 判定） */
  const total = ref(0)
  /** 已初始化（meta 读取完成） */
  const ready = ref(false)
  const syncing = ref(false)
  /** 仅手动刷新时置 true（驱动刷新按钮转圈；自动同步静默不打扰浏览） */
  const manualSyncing = ref(false)
  /** 已加载条数（续页游标） */
  const offset = ref(0)
  const initLoading = ref(false)
  const moreLoading = ref(false)
  /** 同步时间（来自 meta） */
  const syncedAt = ref<string | null>(null)

  /** 陈旧请求丢弃标记：防快速切换筛选导致乱序覆盖 */
  let seq = 0

  const hasMore = computed(() => offset.value + list.value.length < total.value)
  /** 首屏遮罩：未就绪，或首次同步且当前无数据 */
  const loading = computed(
    () => initLoading.value || (syncing.value && total.value === 0 && !syncedAt.value)
  )

  const buildQuery = (): AihotListQuery => ({
    keyword: keyword.value,
    category: category.value,
    timeWindow: timeWindow.value,
    by: by.value
  })

  /** 查询一页：reset 重首屏，否则续页追加；按 seq 丢弃过期响应 */
  const query = async (reset: boolean): Promise<void> => {
    const token = ++seq
    if (reset) initLoading.value = true
    else moreLoading.value = true
    try {
      const nextOffset = reset ? 0 : offset.value + list.value.length
      const res = await listAihotItems(buildQuery(), LOCAL_PAGE_SIZE, nextOffset)
      if (token !== seq) return
      if (reset) {
        list.value = res.items
        offset.value = 0
      } else {
        list.value = [...list.value, ...res.items]
        offset.value += res.items.length
      }
      total.value = res.total
    } catch {
      // 查询失败：保持现状，交由同步 / 下次操作重试
    } finally {
      if (token === seq) {
        initLoading.value = false
        moreLoading.value = false
      }
    }
  }

  /** 筛选变化 / 手动刷新后回到首个分片 */
  const resetShown = (): void => {
    query(true)
  }

  const more = (): void => {
    if (hasMore.value && !moreLoading.value) query(false)
  }

  /** 标记单条为已读：写库 + 本地即时更新（ref 深度响应，UI 无需重查） */
  const markRead = async (id: string): Promise<void> => {
    await markAihotItemRead(id)
    const it = list.value.find((i) => i.id === id)
    if (it) it.read = true
  }

  const sync = async (manual = false): Promise<void> => {
    if (manual) manualSyncing.value = true
    if (syncing.value) return
    syncing.value = true
    try {
      await syncAihotSelected()
      // 同步完成：刷新元数据与列表
      const m = await getAihotMeta()
      syncedAt.value = m.syncedAt
      await query(true)
    } finally {
      syncing.value = false
      manualSyncing.value = false
    }
  }

  /** 初始化：读 meta 即时渲染（后台增量同步，5 分钟内已同步过则跳过） */
  const init = async (): Promise<void> => {
    const m = await getAihotMeta()
    syncedAt.value = m.syncedAt
    ready.value = true
    await query(true)
    const last = m.syncedAt ? dayjs(m.syncedAt).valueOf() : 0
    if (Date.now() - last >= AUTO_SYNC_INTERVAL) sync()
  }

  return {
    ready,
    syncing,
    manualSyncing,
    syncedAt,
    list,
    total,
    hasMore,
    loading,
    initLoading,
    moreLoading,
    init,
    sync,
    resetShown,
    more,
    markRead
  }
}
