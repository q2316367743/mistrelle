<template>
  <page-layout title="记忆">
    <t-list class="setting-list" split size="small">
      <t-list-item>
        <t-list-item-meta
          title="启用记忆系统"
          description="对话空闲后自动提取值得记住的内容到每日短期记忆，后台每日整理进长期记忆，并在新对话中注入"
        />
        <template #action>
          <t-switch :value="enabled" @change="onToggle" />
        </template>
      </t-list-item>
      <t-list-item>
        <t-list-item-meta
          title="立即提取短期记忆"
          description="立即提取所有未提取完的会话记忆到当日文件（通常在一轮回复结束 5 分钟后自动执行）"
        />
        <template #action>
          <t-button
            theme="default"
            variant="outline"
            :loading="extracting"
            :disabled="!enabled"
            @click="onExtractNow"
          >
            立即提取
          </t-button>
        </template>
      </t-list-item>
      <t-list-item>
        <t-list-item-meta
          title="立即整理"
          description="把昨日及更早的每日短期记忆合并进长期记忆（每日首启与运行中跨天会自动执行）"
        />
        <template #action>
          <t-button
            theme="default"
            variant="outline"
            :loading="consolidating"
            :disabled="!enabled"
            @click="onConsolidate"
          >
            立即整理
          </t-button>
        </template>
      </t-list-item>
    </t-list>

    <div class="memory-section">
      <div class="section-header">
        <span class="section-title">长期记忆</span>
        <span class="section-tip">MEMORY.md · 跨会话持久保留，整理时自动去重淘汰，上限 {{ MEMORY_MAX_CHARS }} 字</span>
      </div>
      <t-textarea
        v-model="longTermDraft"
        class="memory-editor"
        :autosize="{ minRows: 6, maxRows: 18 }"
        :placeholder="enabled ? '暂无长期记忆，可通过「立即整理」或对话积累生成' : '记忆系统未启用'"
        :disabled="!enabled"
      />
      <div class="editor-footer">
        <span class="char-count" :class="{ over: longTermDraft.length > MEMORY_MAX_CHARS }">
          {{ longTermDraft.length }} / {{ MEMORY_MAX_CHARS }}
        </span>
        <t-button
          size="small"
          theme="primary"
          :loading="saving"
          :disabled="!enabled || longTermDraft === longTerm"
          @click="onSaveLongTerm"
        >
          保存
        </t-button>
      </div>
    </div>

    <div class="memory-section">
      <div class="section-header">
        <span class="section-title">每日短期记忆</span>
        <div class="day-actions">
          <t-select
            v-model="selectedDate"
            class="w-160px"
            :options="dayOptions"
            placeholder="选择日期"
            :disabled="dates.length === 0"
          />
          <t-button
            theme="danger"
            variant="outline"
            :disabled="!enabled || !selectedDate"
            @click="onRemoveDay"
          >
            删除当日
          </t-button>
        </div>
      </div>
      <t-textarea
        :value="dayContent"
        class="memory-editor"
        :autosize="{ minRows: 4, maxRows: 12 }"
        readonly
        :placeholder="dates.length === 0 ? '暂无每日记忆' : '选择日期查看'"
      />
    </div>
  </page-layout>
</template>
<script lang="ts" setup>
import { MessageUtil, MessageBoxUtil } from '@/utils/modal'
import {
  MEMORY_MAX_CHARS,
  extractPendingSessions,
  listDayMemoryDates,
  readDayMemory,
  readLongTermMemory,
  readSoulState,
  removeDayMemory,
  runConsolidation,
  setMemoryEnabled,
  writeLongTermMemory
} from '@/modules/memory'

const enabled = ref(false)
const consolidating = ref(false)
const extracting = ref(false)
const saving = ref(false)

const longTerm = ref('')
const longTermDraft = ref('')
const dates = ref<string[]>([])
const selectedDate = ref('')
const dayContent = ref('')

const dayOptions = computed(() =>
  [...dates.value].reverse().map((d) => ({ label: d, value: d }))
)

const loadDayContent = async () => {
  dayContent.value = selectedDate.value ? await readDayMemory(selectedDate.value) : ''
}

const refresh = async () => {
  const state = await readSoulState()
  enabled.value = state.memoryEnabled
  longTerm.value = await readLongTermMemory()
  longTermDraft.value = longTerm.value
  dates.value = await listDayMemoryDates()
  if (!dates.value.includes(selectedDate.value)) {
    selectedDate.value = dates.value[dates.value.length - 1] ?? ''
  }
  await loadDayContent()
}

const onToggle = async (value: boolean | number | string) => {
  await setMemoryEnabled(Boolean(value))
  enabled.value = Boolean(value)
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
.setting-list {
  padding: 0 16px;
}

.memory-section {
  margin: 16px;
  padding: 16px;
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-large);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-title {
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.section-tip {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}

.day-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.editor-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.char-count {
  font-size: 12px;
  color: var(--td-text-color-placeholder);

  &.over {
    color: var(--td-error-color);
  }
}
</style>
