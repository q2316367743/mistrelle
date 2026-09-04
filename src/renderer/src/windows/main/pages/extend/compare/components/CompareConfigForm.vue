<template>
  <div class="compare-config">
    <t-alert v-if="!hasAnyModel" theme="info" class="config-alert">
      尚未配置任何聊天模型，请先在「设置 → AI 模型」中配置后再使用对比检测。
    </t-alert>

    <div class="config-section">
      <div class="section-title">第一步 · 选择模型</div>
      <div class="form-row">
        <span class="field-label">对比模型</span>
        <t-select
          v-model="modelKeys"
          class="field-control"
          :options="modelOptions"
          multiple
          filterable
          clearable
          auto-width
          :min-collapsed-num="3"
          :max="COMPARE_MODEL_MAX"
          placeholder="选择 2-6 个参与对比的模型（含已禁用，按提供方分组）"
          :disabled="disabled"
        />
      </div>
    </div>

    <div class="config-section">
      <div class="section-title">第二步 · 检测配置</div>
      <div class="form-row">
        <span class="field-label">速度轮次数</span>
        <t-input-number
          v-model="speedRuns"
          class="field-control"
          theme="column"
          :min="1"
          :max="5"
          :disabled="disabled"
        />
        <span class="field-tip">同一 prompt 测速次数，取中位数（越多越准、耗时越长）</span>
      </div>
      <div class="form-row">
        <span class="field-label">一致性题数</span>
        <t-input-number
          v-model="consistencyCount"
          class="field-control"
          theme="column"
          :min="1"
          :max="3"
          :disabled="disabled"
        />
        <span class="field-tip">取题库前 N 题，每题重复 3 次对比答案稳定性</span>
      </div>
      <div class="form-row">
        <span class="field-label">执行模式</span>
        <t-radio-group v-model="execMode" :disabled="disabled">
          <t-radio value="mixed">混合（推荐）</t-radio>
          <t-radio value="parallel">全并发</t-radio>
          <t-radio value="serial">全串行</t-radio>
        </t-radio-group>
      </div>
      <div class="mode-note">{{ COMPARE_EXEC_MODE_NOTES[execMode] }}</div>
      <div class="form-row">
        <span class="field-label">题库</span>
        <span class="field-tip"
          >共 {{ enabledCount }} 道启用题（{{ tagSummary || '空题库' }}）</span
        >
        <t-button
          variant="outline"
          size="small"
          :disabled="disabled"
          @click="openQuestionBankDrawer"
        >
          题库管理
        </t-button>
      </div>
    </div>

    <div class="form-actions">
      <t-button
        theme="primary"
        size="large"
        :disabled="!canStart || disabled"
        @click="handleSubmit"
      >
        <template #icon><PlayIcon /></template>
        开始对比
      </t-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useSettingAiStore } from '@/windows/main/store'
import { PlayIcon } from 'tdesign-icons-vue-next'
import type { SelectOptionGroup } from 'tdesign-vue-next'
import { openQuestionBankDrawer } from '../modals/CompareQuestionBankDrawer'
import { useModelCompare, COMPARE_MODEL_MAX, COMPARE_MODEL_MIN } from '../useModelCompare'
import type { CompareStartConfig } from '../useModelCompare'
import { getEnabledQuestions } from '../compare-question-bank'
import { COMPARE_EXEC_MODE_NOTES } from '../compare-types'
import type { CompareExecMode } from '../compare-types'

defineProps<{ disabled: boolean }>()

const emit = defineEmits<{ start: [config: CompareStartConfig] }>()

const aiStore = useSettingAiStore()
const { bank } = useModelCompare()

/** 已配置模型选项（chat 类型；不过滤 enable——禁用的提供方 / 模型同样可选，带「已禁用」标注） */
const modelOptions = computed<SelectOptionGroup[]>(() => {
  const groups: SelectOptionGroup[] = []
  for (const provide of aiStore.items) {
    // 同提供方内显示名重复时附加 identifier 消歧
    const nameCounts = new Map<string, number>()
    for (const model of provide.models) {
      nameCounts.set(model.model, (nameCounts.get(model.model) ?? 0) + 1)
    }
    const models = provide.models
      .filter((model) => model.type === 'chat' && model.enable)
      .map((model) => ({
        label:
          (nameCounts.get(model.model) ?? 0) > 1
            ? `${model.model}（${model.identifier}）`
            : model.model,
        value: `${provide.id}:${model.identifier}`
      }))
    if (!models.length) continue
    groups.push({
      group: provide.enable ? provide.name : `${provide.name}（已禁用）`,
      children: models
    })
  }
  return groups
})

const hasAnyModel = computed(() => modelOptions.value.some((g) => g.children?.length))

const modelKeys = ref<string[]>([])
const speedRuns = ref(3)
const consistencyCount = ref(2)
const execMode = ref<CompareExecMode>('mixed')

/** 启用题统计（题库抽屉增删改后 DB 即时保存，bank 实时刷新） */
const enabledQuestions = computed(() => getEnabledQuestions(bank.value))
const enabledCount = computed(() => enabledQuestions.value.length)
const tagSummary = computed(() => {
  const tags: string[] = []
  for (const item of enabledQuestions.value) {
    if (!tags.includes(item.tag)) tags.push(item.tag)
  }
  return tags.join(' / ')
})

const canStart = computed(
  () =>
    modelKeys.value.length >= COMPARE_MODEL_MIN &&
    modelKeys.value.length <= COMPARE_MODEL_MAX &&
    enabledCount.value > 0
)

const handleSubmit = () => {
  if (!canStart.value) return
  emit('start', {
    modelKeys: [...modelKeys.value],
    speedRuns: speedRuns.value,
    execMode: execMode.value,
    consistencyCount: consistencyCount.value
  })
}
</script>

<style scoped lang="less">
.compare-config {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.config-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.form-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.field-label {
  flex-shrink: 0;
  width: 64px;
  font-size: 13px;
  color: var(--td-text-color-secondary);
  text-align: right;
}

.field-control {
  flex-shrink: 0;
}

.field-tip {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}

.mode-note {
  padding-left: 76px;
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}

.config-alert {
  margin: 0;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
