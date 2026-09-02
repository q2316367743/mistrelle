<template>
  <div class="provider-editor">
    <header class="provider-editor__header">
      <h2 class="provider-editor__title">
        {{ draft.name || (isNew ? '新建供应商' : '自定义供应商') }}
      </h2>
      <p class="provider-editor__lead">填写连接信息后保存，再管理可用模型列表</p>
    </header>

    <section class="provider-surface">
      <h3 class="provider-surface__title">连接</h3>
      <t-form :data="draft" layout="vertical" class="provider-editor__form" @submit.prevent>
        <t-form-item label="名称" name="name">
          <t-auto-complete
            v-model="draft.name"
            :options="namePresets"
            placeholder="选择或输入，例如：OpenAI、DeepSeek、Kimi"
            @change="onNameChange"
          />
        </t-form-item>
        <t-form-item label="Base URL" name="baseUrl">
          <t-input
            v-model="draft.baseUrl"
            placeholder="例如：https://api.openai.com/v1"
            clearable
          />
        </t-form-item>
        <t-form-item label="API Key" name="key">
          <t-input v-model="draft.key" type="password" placeholder="请输入 API Key" clearable />
        </t-form-item>
        <t-form-item label="API 格式" name="format">
          <t-select v-model="draft.format">
            <t-option value="anthropic" label="Anthropic Message (/v1/messages)" />
            <t-option value="chat" label="Chat Completions (/chat/completions)" />
            <t-option value="responses" label="Responses (/responses)" />
          </t-select>
        </t-form-item>
      </t-form>

      <div class="provider-editor__commands">
        <t-button theme="primary" :loading="saving" :disabled="!canSave" @click="handleSave">
          保存
        </t-button>
        <t-button :disabled="!draft.baseUrl.trim()" :loading="fetching" @click="handleFetchModels">
          从接口获取模型
        </t-button>
      </div>
    </section>

    <section class="provider-surface">
      <provider-model-list
        :models="draft.models"
        @add="addModel"
        @edit="editModel"
        @delete="deleteModel"
        @toggle="toggleModel"
      />
    </section>
  </div>
</template>

<script lang="ts" setup>
import type { AiModel, AiProvideFormat } from '@/entity'
import { MessageUtil } from '@/utils/modal'
import { useProviderModels } from '../useProviderModels'
import ProviderModelList from './ProviderModelList.vue'

/** 表单数据（只读 source 的快照形状；草稿在组件内部） */
export interface ProviderFormData {
  id?: string
  name: string
  baseUrl: string
  key: string
  format: AiProvideFormat
  models: AiModel[]
}

const props = defineProps<{
  /** 编辑既有提供方时的只读快照；新建为 null */
  source: ProviderFormData | null
  saving: boolean
  namePresets: Array<{ label: string; value: string }>
  providerPresets: Array<{ label: string; baseUrl: string }>
  /** 落盘（父组件 store.put）；可 await，保证模型操作后再提示 */
  persist: (payload: ProviderFormData) => Promise<void>
}>()

function emptyDraft(): ProviderFormData {
  return {
    id: '',
    name: '',
    baseUrl: '',
    key: '',
    format: 'chat',
    models: []
  }
}

function cloneSource(source: ProviderFormData | null): ProviderFormData {
  if (!source) return emptyDraft()
  return {
    id: source.id ?? '',
    name: source.name,
    baseUrl: source.baseUrl,
    key: source.key,
    format: source.format || 'chat',
    models: source.models.map((m) => ({ ...m }))
  }
}

const draft = ref<ProviderFormData>(cloneSource(props.source))
const isNew = computed(() => !draft.value.id)

const canSave = computed(
  () =>
    Boolean(draft.value.baseUrl.trim()) &&
    draft.value.models.length > 0 &&
    Boolean(draft.value.name.trim()) &&
    Boolean(draft.value.key.trim())
)

function onNameChange(value: string | number) {
  if (typeof value === 'string' && value) {
    const matched = props.providerPresets.find((p) => p.label === value)
    if (matched) {
      draft.value.baseUrl = matched.baseUrl
    }
  }
}

async function persistDraft(): Promise<void> {
  await props.persist({
    id: draft.value.id || undefined,
    name: draft.value.name,
    baseUrl: draft.value.baseUrl,
    key: draft.value.key,
    format: draft.value.format,
    models: draft.value.models.map((m) => ({ ...m }))
  })
}

async function handleSave(): Promise<void> {
  if (!draft.value.name.trim()) {
    MessageUtil.warning('请输入提供方名称')
    return
  }
  if (!draft.value.baseUrl.trim()) {
    MessageUtil.warning('请输入接口地址')
    return
  }
  if (!draft.value.key.trim()) {
    MessageUtil.warning('请输入密钥')
    return
  }
  if (draft.value.models.length === 0) {
    MessageUtil.warning('请至少添加一个模型')
    return
  }
  await persistDraft()
}

function handleFetchModels(): void {
  void fetchModels({
    baseUrl: draft.value.baseUrl,
    key: draft.value.key,
    format: draft.value.format
  })
}

const modelsRef = computed({
  get: () => draft.value.models,
  set: (val: AiModel[]) => {
    draft.value.models = val
  }
})

const { fetching, addModel, editModel, deleteModel, toggleModel, fetchModels } = useProviderModels({
  models: modelsRef,
  onSaved: persistDraft
})
</script>

<style scoped lang="less">
.provider-editor {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 720px;
  padding: 8px 8px 32px;
  box-sizing: border-box;
}

.provider-editor__header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.provider-editor__title {
  margin: 0;
  font: var(--td-font-title-large);
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.provider-editor__lead {
  margin: 0;
  font: var(--td-font-body-medium);
  color: var(--td-text-color-secondary);
}

.provider-surface {
  background: var(--fluent-card-bg);
  border: 1px solid var(--fluent-card-border);
  border-radius: var(--fluent-radius-card);
  box-shadow: var(--fluent-elevation-1);
  padding: 16px;
}

.provider-surface__title {
  margin: 0 0 12px;
  padding-left: 2px;
  font: var(--td-font-title-small);
  color: var(--td-text-color-secondary);
}

.provider-editor__form {
  max-width: 640px;
}

.provider-editor__commands {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  margin-left: 16px;
}
</style>
