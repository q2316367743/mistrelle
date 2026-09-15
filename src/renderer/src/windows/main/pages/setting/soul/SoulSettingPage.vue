<template>
  <page-layout title="记忆">
    <div class="soul-page">
      <t-alert
        v-if="enabled && !modelReady"
        theme="warning"
        title="记忆系统已启用，但还没有选择记忆模型"
        :close="false"
      >
        <template #message>
          提取短期记忆、整理长期记忆都需要调用模型，未选择前不会产生任何记忆。请在下方「记忆设置」中选择一个模型。
        </template>
      </t-alert>

      <p class="soul-page__lead">
        让伙伴记住你们的过去：对话中自动提取短期记忆，每日整理进长期记忆，并在此后每轮对话中作为背景注入。
      </p>

      <memory-overview-card
        :enabled="enabled"
        :long-term-chars="longTermDraft.length"
        :long-term-max="MEMORY_MAX_CHARS"
        :day-count="dates.length"
        :last-consolidated-label="lastConsolidatedLabel"
        @update:enabled="onToggle"
      />

      <section class="soul-group">
        <h2 class="soul-group__title">记忆设置</h2>
        <memory-setting-card
          v-model="modelKey"
          :options="options"
          :enabled="enabled"
          :model-ready="modelReady"
          :extracting="extracting"
          :consolidating="consolidating"
          :consolidate-desc="consolidateDesc"
          @extract="onExtractNow"
          @consolidate="onConsolidate"
        />
      </section>

      <section class="soul-group">
        <h2 class="soul-group__title">长期记忆</h2>
        <long-term-memory-card
          v-model:draft="longTermDraft"
          :max-chars="MEMORY_MAX_CHARS"
          :limits-label="memorySectionLimitsLabel()"
          :enabled="enabled"
          :saving="saving"
          :dirty="longTermDraft !== longTerm"
          @save="onSaveLongTerm"
        />
      </section>

      <section class="soul-group">
        <h2 class="soul-group__title">每日短期记忆</h2>
        <day-memory-card
          v-model:date="selectedDate"
          :options="dayOptions"
          :enabled="enabled"
          :content="dayContent"
          @remove="onRemoveDay"
        />
      </section>
    </div>
  </page-layout>
</template>
<script lang="ts" setup>
import { MessageUtil, MessageBoxUtil } from '@/utils/modal'
import { toDateString } from '@/utils/lang/FormatUtil'
import { useSettingAiStore, useSettingDefaultStore } from '@/windows/main/store'
import {
  MEMORY_MAX_CHARS,
  extractPendingSessions,
  listDayMemoryDates,
  memorySectionLimitsLabel,
  readDayMemory,
  readLongTermMemory,
  readSoulState,
  removeDayMemory,
  runConsolidation,
  setMemoryEnabled,
  writeLongTermMemory
} from '@/windows/main/modules/memory'
import MemoryOverviewCard from './components/MemoryOverviewCard.vue'
import MemorySettingCard from './components/MemorySettingCard.vue'
import LongTermMemoryCard from './components/LongTermMemoryCard.vue'
import DayMemoryCard from './components/DayMemoryCard.vue'

const settingDefaultStore = useSettingDefaultStore()
const { options } = toRefs(useSettingAiStore())

const enabled = ref(false)
const consolidating = ref(false)
const extracting = ref(false)
const saving = ref(false)

const longTerm = ref('')
const longTermDraft = ref('')
const dates = ref<string[]>([])
const selectedDate = ref('')
const dayContent = ref('')
const lastConsolidatedAt = ref('')

/** 记忆模型：复用 SettingDefault.defaultSummaryModel（清空时归一为空串，保持 string 契约） */
const modelKey = computed({
  get: () => settingDefaultStore.state.defaultSummaryModel,
  set: (value) => {
    settingDefaultStore.state.defaultSummaryModel = typeof value === 'string' ? value : ''
  }
})

/**
 * 记忆能否产出内容：与 memoryChatCompletion 同源——只认记忆模型，不做任何兜底。
 * 未配置时提取与整理必然失败，页面对这两个动作做真实门控而非仅提示。
 */
const modelReady = computed(() => Boolean(modelKey.value))

const lastConsolidatedLabel = computed(() =>
  lastConsolidatedAt.value ? toDateString(lastConsolidatedAt.value) : '尚未整理过'
)

const dayOptions = computed(() => [...dates.value].reverse().map((d) => ({ label: d, value: d })))

const consolidateDesc = computed(
  () =>
    `把昨日及更早的每日短期记忆合并进长期记忆（每日首启与运行中跨天会自动执行），上次整理：${
      lastConsolidatedLabel.value
    }`
)

const loadDayContent = async () => {
  dayContent.value = selectedDate.value ? await readDayMemory(selectedDate.value) : ''
}

const refresh = async () => {
  const state = await readSoulState()
  enabled.value = state.memoryEnabled
  lastConsolidatedAt.value = state.lastConsolidatedAt ?? ''
  longTerm.value = await readLongTermMemory()
  longTermDraft.value = longTerm.value
  dates.value = await listDayMemoryDates()
  if (!dates.value.includes(selectedDate.value)) {
    selectedDate.value = dates.value[dates.value.length - 1] ?? ''
  }
  await loadDayContent()
}

const onToggle = async (value: boolean) => {
  await setMemoryEnabled(value)
  enabled.value = value
  MessageUtil.success(value ? '记忆系统已启用' : '记忆系统已关闭')
}

const onExtractNow = async () => {
  extracting.value = true
  try {
    const summary = await extractPendingSessions()
    if (summary.entries > 0) {
      MessageUtil.success(`已提取 ${summary.entries} 条记忆（${summary.sessions} 个会话）`)
    } else {
      MessageUtil.info(
        summary.sessions > 0 ? '已消费新对话，无值得记住的内容' : '暂无待提取的新对话'
      )
    }
    await refresh()
  } finally {
    extracting.value = false
  }
}

const onConsolidate = async () => {
  consolidating.value = true
  try {
    const result = await runConsolidation({ manual: true })
    if (result.ok) {
      MessageUtil.success(result.message)
      await refresh()
    } else {
      MessageUtil.warning(result.message)
    }
  } finally {
    consolidating.value = false
  }
}

const onSaveLongTerm = async () => {
  if (longTermDraft.value.length > MEMORY_MAX_CHARS) {
    MessageUtil.warning(`长期记忆超过上限（${MEMORY_MAX_CHARS} 字），请精简后保存`)
    return
  }
  saving.value = true
  try {
    await writeLongTermMemory(longTermDraft.value.trim())
    longTerm.value = longTermDraft.value
    MessageUtil.success('长期记忆已保存')
  } catch (e) {
    MessageUtil.error('长期记忆保存失败', e)
  } finally {
    saving.value = false
  }
}

const onRemoveDay = () => {
  if (!selectedDate.value) return
  MessageBoxUtil.confirm(`删除 ${selectedDate.value} 的短期记忆？删除后无法恢复`, '删除每日记忆')
    .then(async () => {
      await removeDayMemory(selectedDate.value)
      MessageUtil.success('已删除')
      await refresh()
    })
    .catch(() => undefined)
}

watch(selectedDate, () => void loadDayContent())

onMounted(() => void refresh())
</script>
<style scoped lang="less">
.soul-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  padding: 8px 24px 32px;
  box-sizing: border-box;
}

.soul-page__lead {
  margin: 0;
  font: var(--td-font-body-medium);
  color: var(--td-text-color-secondary);
}

.soul-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.soul-group__title {
  margin: 0;
  padding-left: 4px;
  font: var(--td-font-title-small);
  color: var(--td-text-color-secondary);
}
</style>
