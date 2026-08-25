<template>
  <div class="aihot-dailies">
    <div class="aihot-dailies__toolbar">
      <span class="aihot-dailies__hint">每天 08:00（上海时区）生成的往日 AI 资讯摘要</span>
      <t-select
        v-model="selectedDate"
        :options="archiveOptions"
        :loading="indexLoading"
        class="aihot-dailies__select"
        @change="handleSelect"
      />
      <t-button variant="outline" shape="square" :loading="loading" @click="refresh">
        <template #icon>
          <refresh-icon />
        </template>
      </t-button>
    </div>

    <div class="aihot-dailies__body">
      <t-loading :loading="loading" size="small" class="aihot-dailies__loading">
        <aihot-daily-report v-if="report" :report="report" />
        <empty-result v-else-if="!loading" title="暂无日报" tip="日报尚未生成，请稍后再来" />
      </t-loading>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { RefreshIcon } from 'tdesign-icons-vue-next'
import EmptyResult from '@/components/Result/EmptyResult.vue'
import {
  aihotApiV1Dailies,
  aihotApiV1DailiesDate,
  aihotApiV1DailiesLatest,
  type AihotDailyEntry,
  type AihotDailyReport as AihotDailyReportData
} from '@/modules/api/aihot'
import AihotDailyReport from './AihotDailyReport.vue'
import { aihotNotifyError } from '@/modules/aihot'

const loading = ref(false)
const indexLoading = ref(false)
const archive = ref<Array<AihotDailyEntry>>([])
const selectedDate = ref('')
const report = ref<AihotDailyReportData | null>(null)

/** 过去日报不可变：按 date 缓存，同一天绝不重复请求 */
const cache = new Map<string, AihotDailyReportData>()

const archiveOptions = computed(() =>
  archive.value.map((entry) => ({
    label: entry.leadTitle ? `${entry.date} · ${entry.leadTitle}` : entry.date,
    value: entry.date
  }))
)

/** 最新日报直接请求稳定 URL（/latest），不从索引猜日期 */
const loadLatest = async () => {
  loading.value = true
  try {
    const data = await aihotApiV1DailiesLatest()
    cache.set(data.report.date, data.report)
    report.value = data.report
    selectedDate.value = data.report.date
  } catch (e) {
    aihotNotifyError('加载最新日报失败', e)
  } finally {
    loading.value = false
  }
}

const loadIndex = async () => {
  indexLoading.value = true
  try {
    const data = await aihotApiV1Dailies(30)
    archive.value = data.items ?? []
  } catch (e) {
    aihotNotifyError('加载日报归档失败', e)
  } finally {
    indexLoading.value = false
  }
}

const handleSelect = async (date: unknown) => {
  const key = String(date)
  const cached = cache.get(key)
  if (cached) {
    report.value = cached
    return
  }
  loading.value = true
  try {
    const data = await aihotApiV1DailiesDate(key)
    cache.set(data.report.date, data.report)
    report.value = data.report
  } catch (e) {
    aihotNotifyError('加载日报失败', e)
  } finally {
    loading.value = false
  }
}

/** 刷新只重拉最新与归档索引；日报本体不可变，缓存不清 */
const refresh = () => {
  loadLatest()
  loadIndex()
}

onMounted(() => {
  loadLatest()
  loadIndex()
})
</script>
<style scoped lang="less">
.aihot-dailies {
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
    padding: 10px 12px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--td-component-stroke);
  }

  &__hint {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }

  &__select {
    width: 320px;
    flex-shrink: 0;
  }

  &__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__loading {
    min-height: 200px;
    width: 100%;

    :deep(.empty-result-container) {
      height: auto;
      min-height: 240px;
    }
  }
}
</style>
