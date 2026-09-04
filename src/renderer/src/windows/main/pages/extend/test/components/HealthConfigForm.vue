<template>
  <div class="health-config">
    <t-alert v-if="!hasAnyModel" theme="info" class="config-alert">
      尚未配置任何聊天模型，可直接手动填写下方信息检测；配置后可一键选择填充。
    </t-alert>

    <div class="config-section">
      <div class="section-title">第一步 · 基本配置</div>
      <div class="form-row">
        <span class="field-label">选择模型</span>
        <t-select
          v-model="selectedKey"
          class="field-control"
          :options="modelOptions"
          filterable
          clearable
          placeholder="从已配置模型一键选择（含已禁用）"
          :disabled="disabled"
          @change="handleSelect"
          @clear="handleClearSelect"
        />
      </div>
      <div class="form-row">
        <span class="field-label">接口地址</span>
        <t-input
          v-model="apiUrl"
          class="field-control"
          placeholder="如 https://api.example.com/v1"
          :disabled="disabled"
        />
      </div>
      <div class="form-row">
        <span class="field-label">API 密钥</span>
        <t-input
          v-model="apiKey"
          class="field-control"
          type="password"
          placeholder="sk-…（仅用于本次检测，不落库）"
          :disabled="disabled"
        />
      </div>
      <div class="form-row">
        <span class="field-label">模型 ID</span>
        <t-input
          v-model="modelId"
          class="field-control"
          placeholder="如 gpt-4o / deepseek-chat"
          :disabled="disabled"
          @change="handleManualModel"
        />
      </div>
      <div class="form-row">
        <span class="field-label">接口格式</span>
        <t-radio-group v-model="format" :disabled="disabled">
          <t-radio value="chat">OpenAI Chat</t-radio>
          <t-radio value="anthropic">Anthropic</t-radio>
          <t-radio value="responses">Responses</t-radio>
        </t-radio-group>
      </div>
    </div>

    <div class="config-section">
      <div class="section-title">第二步 · 检测配置</div>
      <div class="form-row">
        <span class="field-label">检测项目</span>
        <t-radio-group v-model="mode" :disabled="disabled">
          <t-radio value="basic">基础检测（4 项，约 30 秒）</t-radio>
          <t-radio value="full">完整检测（12 项，约 2 分钟）</t-radio>
        </t-radio-group>
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
        开始检测
      </t-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useSettingAiStore } from '@/windows/main/store'
import { PlayIcon } from 'tdesign-icons-vue-next'
import type { SelectOptionGroup } from 'tdesign-vue-next'
import type { HealthCheckConfig } from '../useHealthChecks'

defineProps<{ disabled: boolean }>()

const emit = defineEmits<{ start: [config: HealthCheckConfig] }>()

const aiStore = useSettingAiStore()

/**
 * 已配置模型选项（chat 类型；不过滤 enable——禁用的提供方 / 模型同样可选，带「已禁用」标注）。
 * value = `${provideId}:${identifier}`，选中后反查提供方填充地址 / 密钥 / 格式。
 */
const modelOptions = computed<SelectOptionGroup[]>(() => {
  const groups: SelectOptionGroup[] = []
  for (const provide of aiStore.items) {
    const models = provide.models
      .filter((model) => model.type === 'chat' && model.enable)
      .map((model) => ({
        label: model.model,
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

const selectedKey = ref('')
const apiUrl = ref('')
const apiKey = ref('')
const modelId = ref('')
const format = ref<HealthApiFormat>('chat')
const mode = ref<HealthCheckMode>('full')
/** 选中模型时记录的来源快照；手动改模型 ID 后置空 */
const provideName = ref<string | null>(null)
const modelName = ref<string | null>(null)

const handleSelect = (value: unknown) => {
  const key = typeof value === 'string' ? value : ''
  if (!key) return
  const [provideId, ...rest] = key.split(':')
  const identifier = rest.join(':')
  const provide = aiStore.items.find((it) => it.id === provideId)
  const model = provide?.models.find((it) => it.identifier === identifier)
  if (!provide || !model) return
  apiUrl.value = provide.baseUrl
  apiKey.value = provide.key
  modelId.value = model.identifier
  format.value = provide.format ?? 'chat'
  provideName.value = provide.name
  modelName.value = model.model
}

const handleClearSelect = () => {
  selectedKey.value = ''
}

/** 手动改模型 ID 后，展示名快照失效（提供方仍可能是选中来源） */
const handleManualModel = () => {
  modelName.value = null
}

const canStart = computed(() => apiUrl.value.trim().length > 0 && modelId.value.trim().length > 0)

const handleSubmit = () => {
  if (!canStart.value) return
  emit('start', {
    apiUrl: apiUrl.value.trim(),
    apiKey: apiKey.value.trim(),
    modelId: modelId.value.trim(),
    format: format.value,
    mode: mode.value,
    provideName: provideName.value,
    modelName: modelName.value
  })
}
</script>

<style scoped lang="less">
.health-config {
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
  flex: 1;
  min-width: 0;
}

.config-alert {
  margin: 0;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
