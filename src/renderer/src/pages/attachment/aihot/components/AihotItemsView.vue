<template>
  <div class="aihot-items">
    <div class="aihot-items__toolbar">
      <t-input
        v-model="keyword"
        clearable
        maxlength="200"
        placeholder="搜索关键词（至少 2 个字符）"
        class="aihot-items__search"
      >
        <template #prefix-icon>
          <search-icon />
        </template>
      </t-input>
      <t-select v-model="mode" :options="modeOptions" class="aihot-items__filter" />
      <t-select
        v-model="timeWindow"
        :options="windowOptions"
        class="aihot-items__filter"
        @change="handleFilterChange"
      />
      <t-select
        v-model="by"
        :options="byOptions"
        class="aihot-items__filter"
        @change="handleFilterChange"
      />
      <t-select
        v-model="category"
        :options="categoryOptions"
        class="aihot-items__filter-wide"
        @change="handleFilterChange"
      />
      <t-button
        variant="outline"
        shape="square"
        :loading="isLocal ? manualSyncing : onlineLoading"
        @click="refresh"
      >
        <template #icon>
          <refresh-icon />
        </template>
      </t-button>
    </div>

    <div class="aihot-items__status">
      <template v-if="isLocal">
        <span>本地精选 {{ total }} 条</span>
        <span v-if="unreadCount">未读 {{ unreadCount }} 条</span>
        <span v-if="syncedAt">同步于 {{ aihotRelativeTime(syncedAt) }}</span>
        <span v-else>首次同步中…</span>
      </template>
      <span v-else>在线查询公开池（覆盖最近 7 天）</span>
    </div>

    <div class="aihot-items__body">
      <t-loading :loading="viewLoading" size="small" class="aihot-items__loading">
        <aihot-timeline-list
          v-if="displayItems.length > 0"
          :groups="displayGroups"
          :by="by"
          :show-selected="mode === 'all'"
          class="px-8px"
          @read="onItemRead"
        />
        <empty-result
          v-else-if="!viewLoading"
          title="暂无资讯"
          tip="试试调整筛选条件或换个关键词"
        />
      </t-loading>
    </div>

    <div v-if="displayItems.length > 0" class="aihot-items__footer">
      <t-button
        v-if="displayHasMore"
        variant="dashed"
        :loading="footerLoading"
        :disabled="viewLoading"
        @click="loadMore"
      >
        加载更多
      </t-button>
      <span v-else class="aihot-items__end">没有更多了</span>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { RefreshIcon, SearchIcon } from 'tdesign-icons-vue-next'
import EmptyResult from '@/components/Result/EmptyResult.vue'
import { aihotApiV1Items, type AihotItem, type AihotPage } from '@/modules/api/aihot'
import { aihotNotifyError, isAihotBadRequest } from '@/modules/aihot'
import AihotTimelineList from './AihotTimelineList.vue'
import { aihotRelativeTime, groupAihotItemsByDay } from '../aihot-page-utils'
import { useAihotSelectedItems } from '../useAihotSelectedItems'

const ONLINE_PAGE_SIZE = 20

const keyword = ref('')
const mode = ref<'selected' | 'all'>('selected')
const timeWindow = ref<'24h' | '7d' | 'all'>('7d')
const by = ref<'timeline' | 'published'>('timeline')
const category = ref('')

const modeOptions = [
  { label: '精选', value: 'selected' },
  { label: '全部', value: 'all' }
]
const ONLINE_WINDOW_OPTIONS = [
  { label: '近 24 小时', value: '24h' },
  { label: '近 7 天', value: '7d' }
]
const windowOptions = computed(() =>
  mode.value === 'selected'
    ? [...ONLINE_WINDOW_OPTIONS, { label: '全部时间', value: 'all' }]
    : ONLINE_WINDOW_OPTIONS
)
const byOptions = [
  { label: '时间线排序', value: 'timeline' },
  { label: '发布时间排序', value: 'published' }
]
const categoryOptions = [
  { label: '全部分类', value: '' },
  { label: 'AI 模型', value: 'ai-models' },
  { label: 'AI 产品', value: 'ai-products' },
  { label: '行业', value: 'industry' },
  { label: '论文', value: 'paper' },
  { label: '贴士', value: 'tip' }
]

const isLocal = computed(() => mode.value === 'selected')

/** 本页未读计数（仅本地精选库；在线池无已读概念） */
const unreadCount = computed(() =>
  isLocal.value ? list.value.filter((i) => i.read === false).length : 0
)

/** 标记已读：仅本地精选库生效（在线池不入本地库） */
const onItemRead = (id: string) => {
  if (isLocal.value) markRead(id)
}

// ====================================== 本地精选数据源 ======================================
const {
  manualSyncing,
  syncedAt,
  list,
  total,
  hasMore: localHasMore,
  loading: localLoading,
  moreLoading: listMoreLoading,
  init,
  sync,
  resetShown,
  more,
  markRead
} = useAihotSelectedItems({ keyword, category, timeWindow, by })

// ====================================== 在线全量池数据源 ======================================
const onlineList = ref<Array<AihotItem>>([])
const onlinePage = ref<AihotPage | null>(null)
const onlineLoading = ref(false)
const moreLoading = ref(false)

const onlineHasMore = computed(
  () => onlinePage.value?.hasMore === true && !!onlinePage.value.nextCursor
)

// 在线 /items 游标查询（all 模式）：reset 不带 cursor，追加原样回传上页 nextCursor；任何筛选变化须 reset（游标仅同查询复用）
const loadOnline = async (reset: boolean) => {
  if (reset) {
    onlineLoading.value = true
  } else {
    moreLoading.value = true
  }
  try {
    const q = keyword.value.trim()
    const data = await aihotApiV1Items({
      mode: 'all',
      window: timeWindow.value === '24h' ? '24h' : '7d',
      by: by.value,
      category: category.value || undefined,
      q: q.length >= 2 && q.length <= 200 ? q : undefined,
      limit: ONLINE_PAGE_SIZE,
      cursor: reset ? undefined : (onlinePage.value?.nextCursor ?? undefined)
    })
    onlineList.value = reset ? data.items : [...onlineList.value, ...data.items]
    onlinePage.value = data.page
  } catch (e) {
    if (!reset && isAihotBadRequest(e)) {
      // 窗口滑动导致游标失效（invalid_cursor）：按接入文档从第一页重来
      await loadOnline(true)
      return
    }
    aihotNotifyError('加载资讯失败', e)
  } finally {
    onlineLoading.value = false
    moreLoading.value = false
  }
}

// ====================================== 统一展示出口 ======================================
const displayItems = computed(() => (isLocal.value ? list.value : onlineList.value))
const displayGroups = computed(() => groupAihotItemsByDay(displayItems.value, by.value))
const displayHasMore = computed(() => (isLocal.value ? localHasMore.value : onlineHasMore.value))
/** 首屏遮罩（本地为 DB 首查 / 首次同步引导，在线为在线查询加载态） */
const viewLoading = computed(() => (isLocal.value ? localLoading.value : onlineLoading.value))
/** 「加载更多」按钮 loading：本地走 DB 续页，在线走游标续页 */
const footerLoading = computed(() => (isLocal.value ? listMoreLoading.value : moreLoading.value))

const refresh = () => (isLocal.value ? sync(true) : loadOnline(true))

const handleFilterChange = () => {
  if (isLocal.value) {
    resetShown()
  } else {
    loadOnline(true)
  }
}

const loadMore = () => (isLocal.value ? more() : loadOnline(false))

watch(mode, (m) => {
  if (m === 'selected') {
    resetShown()
    init()
  } else {
    // 全部时间仅本地缓存可用，在线模式回退默认 7 天
    if (timeWindow.value === 'all') timeWindow.value = '7d'
    if (onlineList.value.length === 0) loadOnline(true)
  }
})

watchDebounced(
  keyword,
  () => {
    handleFilterChange()
  },
  { debounce: 400 }
)

onMounted(() => {
  init()
})
</script>
<style scoped lang="less">
.aihot-items {
  display: flex;
  flex-direction: column;
  height: calc(100% - 10px);
  margin-top: 8px;
  overflow: hidden;
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-medium);
  background-color: var(--td-bg-color-container);

  &__toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--td-component-stroke);
  }

  &__search {
    flex: 1;
    min-width: 160px;
  }

  &__filter {
    width: 122px;
    flex-shrink: 0;
  }

  &__filter-wide {
    width: 104px;
    flex-shrink: 0;
  }

  &__status {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 14px;
    flex-shrink: 0;
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
    border-bottom: 1px solid var(--td-component-stroke);
  }

  &__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  &__loading {
    min-height: 200px;
    width: 100%;

    :deep(.empty-result-container) {
      height: auto;
      min-height: 240px;
    }
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 12px;
    flex-shrink: 0;
    border-top: 1px solid var(--td-component-stroke);
  }

  &__end {
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }
}
</style>
