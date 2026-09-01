<template>
  <div>
    <!-- 基本信息 -->
    <t-form :data="form" layout="vertical" class="ai-setting-form">
      <t-form-item label="名称" name="name">
        <t-auto-complete
          v-model="form.name"
          :options="namePresets"
          placeholder="选择或输入，例如：OpenAI、DeepSeek"
          @change="onNameChange"
        />
      </t-form-item>
      <t-form-item label="Base URL" name="baseUrl">
        <t-input v-model="form.baseUrl" placeholder="例如：https://api.openai.com/v1" />
      </t-form-item>
      <t-form-item label="API Key" name="key">
        <t-input
          v-model="form.key"
          type="password"
          placeholder="请输入 API Key"
          allow-clear
        />
      </t-form-item>
      <t-form-item label="API 格式" name="key">
        <t-select v-model="form.format" default-value="chat">
          <t-option value="anthropic" label="Anthropic Message (/v1/messages)" />
          <t-option value="chat" label="Chat Completions (/chat/completions)" />
          <t-option value="responses" label="Responses (/responses)" />
        </t-select>
      </t-form-item>
      <t-form-item>
        <t-space>
          <t-button
            theme="primary"
            :loading="saving"
            :disabled="!form.baseUrl.trim() || form.models.length === 0"
            @click="emit('save')"
          >
            保存
          </t-button>
          <t-button
            :disabled="!form.baseUrl.trim()"
            :loading="fetching"
            @click="emit('fetchModels')"
          >
            从接口获取模型
          </t-button>
        </t-space>
      </t-form-item>
    </t-form>

    <t-divider />

    <!-- 模型管理 -->
    <div class="model-section">
      <div class="model-section__header">
        <span class="model-section__title">模型列表</span>
        <t-button size="small" @click="emit('addModel')">
          <template #icon><AddIcon /></template>
          添加模型
        </t-button>
      </div>
      <t-input
        v-model="modelKeyword"
        clearable
        placeholder="搜索模型 ID 或名称"
        class="model-section__search"
      >
        <template #prefixIcon>
          <SearchIcon />
        </template>
      </t-input>

      <template v-if="form.models.length > 0">
        <template v-for="group in modelGroups" :key="group.family">
          <div class="model-group">
            <div class="model-group__title">{{ group.family }}</div>
            <div v-for="model in group.models" :key="model.identifier" class="model-item">
              <div class="model-item__info">
                <t-tag
                  v-if="model.type !== 'chat'"
                  size="small"
                  variant="light"
                  :theme="MODEL_TYPE_THEME[model.type]"
                >
                  {{ MODEL_TYPE_LABEL[model.type] }}
                </t-tag>
                <t-tooltip :content="model.identifier" placement="top">
                  <span class="model-item__name">{{ model.model || model.identifier }}</span>
                </t-tooltip>
              </div>
              <div class="model-item__actions">
                <t-switch
                  :value="model.enable"
                  @change="(val: any) => emit('toggleModel', model, Boolean(val))"
                />
                <t-button
                  theme="primary"
                  variant="text"
                  size="small"
                  shape="square"
                  @click="emit('editModel', model)"
                >
                  <template #icon><EditIcon /></template>
                </t-button>
                <t-button
                  theme="danger"
                  variant="text"
                  size="small"
                  shape="square"
                  @click="emit('deleteModel', model)"
                >
                  <template #icon><DeleteIcon /></template>
                </t-button>
              </div>
            </div>
          </div>
        </template>
        <t-empty
          v-if="modelGroups.length === 0"
          description="未找到匹配的模型"
          style="margin-top: 12px"
        />
      </template>
      <t-empty
        v-else
        description="暂无模型，请从接口获取或手动添加"
        style="margin-top: 12px"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { AddIcon, DeleteIcon, EditIcon, SearchIcon } from 'tdesign-icons-vue-next'
import type { AiModel, AiProvideFormat } from '@/entity'
import { MODEL_TYPE_LABEL, MODEL_TYPE_THEME } from '@/utils/aiModel'

/** 表单数据（受控：父组件持有 reactive form 并 v-model 各字段） */
export interface ProviderFormData {
  /** 编辑既有提供方时的 id（新增为空） */
  id?: string
  name: string
  baseUrl: string
  key: string
  format: AiProvideFormat
  models: AiModel[]
}

const props = defineProps<{
  form: ProviderFormData
  saving: boolean
  fetching: boolean
  namePresets: Array<{ label: string; value: string }>
  providerPresets: Array<{ label: string; baseUrl: string }>
}>()

const emit = defineEmits<{
  save: []
  fetchModels: []
  addModel: []
  editModel: [model: AiModel]
  deleteModel: [model: AiModel]
  toggleModel: [model: AiModel, val: boolean]
}>()

const modelKeyword = ref('')

function onNameChange(value: string | number) {
  if (typeof value === 'string' && value) {
    const matched = props.providerPresets.find((p) => p.label === value)
    if (matched) {
      props.form.baseUrl = matched.baseUrl
      return
    }
  }
}

function getModelFamily(id: string): string {
  return id.split(/[-_.\d]/).filter(Boolean)[0] || id
}

const modelGroups = computed(() => {
  const kw = modelKeyword.value.trim().toLowerCase()
  const list = kw
    ? props.form.models.filter(
        (m) => m.identifier.toLowerCase().includes(kw) || (m.model || '').toLowerCase().includes(kw)
      )
    : props.form.models
  const map = new Map<string, AiModel[]>()
  for (const m of list) {
    const family = getModelFamily(m.identifier)
    if (!map.has(family)) map.set(family, [])
    map.get(family)!.push(m)
  }
  return Array.from(map.entries())
    .map(([family, items]) => ({
      family,
      models: [...items].sort((a, b) => a.identifier.localeCompare(b.identifier))
    }))
    .sort((a, b) => a.family.localeCompare(b.family))
})
</script>

<style scoped lang="less">
.ai-setting-form {
  max-width: 640px;
}

// 模型区域
.model-section {
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__title {
    font-size: 16px;
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  &__search {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--td-bg-color-container);
    padding: 12px 0 12px;
  }
}

.model-group {
  margin-top: 16px;

  &__title {
    font-size: 14px;
    font-weight: 600;
    color: var(--td-text-color-primary);
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--td-bg-color-component);
  }
}

.model-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: var(--td-radius-default);
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--td-bg-color-secondaryhover);
  }

  &__info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }

  &__name {
    font-size: 13px;
    color: var(--td-text-color-secondary);
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
}
</style>
