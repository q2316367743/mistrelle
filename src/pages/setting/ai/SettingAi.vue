<template>
  <page-layout title="AI 设置">
    <div class="ai-setting-layout">
      <!-- 左侧：提供方列表 -->
      <div :class="['ai-setting-sidebar']">
        <div class="ai-setting-sidebar__list">
          <t-button theme="primary" block @click="handleAdd">
            <template #icon><AddIcon /></template>
            新增
          </t-button>
          <t-divider size="8px" />
          <div
            v-for="item in items"
            :key="item.id"
            :class="['ai-setting-sidebar__item', { 'is-active': selectedId === item.id }]"
          >
            <div class="ai-setting-sidebar__item-content" @click="selectItem(item.id)">
              <span class="ai-setting-sidebar__item-name">{{ item.name || '未命名' }}</span>
            </div>
            <t-popconfirm content="确定删除此提供方？" @confirm="handleDelete(item.id)">
              <t-button theme="danger" variant="text" size="small">
                <template #icon><DeleteIcon /></template>
              </t-button>
            </t-popconfirm>
          </div>
          <t-empty v-if="items.length === 0" description="暂无提供方，点击新增添加" />
        </div>
      </div>

      <!-- 右侧：编辑面板 -->
      <div class="ai-setting-main">
        <template v-if="!selectedId && !isCreating">
          <t-empty description="请选择一个提供方或新增" />
        </template>
        <template v-else>
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
            <t-form-item label="接口地址" name="baseUrl">
              <t-input v-model="form.baseUrl" placeholder="例如：https://api.openai.com/v1" />
            </t-form-item>
            <t-form-item label="密钥" name="key">
              <t-input
                v-model="form.key"
                type="password"
                placeholder="请输入 API Key"
                allow-clear
              />
            </t-form-item>
            <t-form-item>
              <t-space>
                <t-button
                  theme="primary"
                  :loading="saving"
                  :disabled="!form.baseUrl.trim() || form.models.length === 0"
                  @click="handleSave"
                >
                  保存
                </t-button>
                <t-button
                  :disabled="!form.baseUrl.trim()"
                  :loading="fetching"
                  @click="handleFetchModels"
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
              <t-button size="small" @click="handleAddModel">
                <template #icon><AddIcon /></template>
                添加模型
              </t-button>
            </div>

            <template v-if="form.models.length > 0">
              <template v-for="group in modelGroups" :key="group.family">
                <div class="model-group">
                  <div class="model-group__title">{{ group.family }}</div>
                  <div v-for="model in group.models" :key="model.identifier" class="model-item">
                    <div class="model-item__info">
                      <t-tooltip :content="model.identifier" placement="top">
                        <span class="model-item__name">{{ model.model || model.identifier }}</span>
                      </t-tooltip>
                    </div>
                    <div class="model-item__actions">
                      <t-switch
                        :value="model.enable"
                        @change="(val: any) => handleModelEnableChange(model, Boolean(val))"
                      />
                      <t-button
                        theme="primary"
                        variant="text"
                        size="small"
                        shape="square"
                        @click="handleEditModel(model)"
                      >
                        <template #icon><EditIcon /></template>
                      </t-button>
                      <t-button
                        theme="danger"
                        variant="text"
                        size="small"
                        shape="square"
                        @click="handleDeleteModel(model)"
                      >
                        <template #icon><DeleteIcon /></template>
                      </t-button>
                    </div>
                  </div>
                </div>
              </template>
            </template>
            <t-empty
              v-else
              description="暂无模型，请从接口获取或手动添加"
              style="margin-top: 12px"
            />
          </div>
        </template>
      </div>
    </div>
  </page-layout>
</template>

<script lang="ts" setup>
import OpenAI from 'openai'
import { AddIcon, DeleteIcon, EditIcon } from 'tdesign-icons-vue-next'
import { useSettingAiStore } from '@/store'
import type { AiModel } from '@/entity'
import { MessageUtil } from '@/utils/modal'
import { openModelDialog } from './modals/OpenModelDialog'
import { fetchModelsDrawer } from './modals/FetchModelsDrawer'

const store = useSettingAiStore()

// ---------- 左侧列表 ----------

const items = computed(() => store.items)
const selectedId = ref<string>('')

const isCreating = ref(false)

// ---------- 右侧表单 ----------

let form = reactive({
  id: '',
  name: '',
  baseUrl: '',
  key: '',
  models: [] as AiModel[]
})

// 选中提供方：填充表单
function selectItem(id: string) {
  if (id === selectedId.value) {
    selectedId.value = ''
    isCreating.value = true
    form.id = ''
    form.name = ''
    form.baseUrl = ''
    form.key = ''
    form.models = [] as AiModel[]
    return
  }
  selectedId.value = id
  const item = store.items.find((i) => i.id === id)
  if (item) {
    isCreating.value = false
    form.id = item.id
    form.name = item.name
    form.baseUrl = item.baseUrl
    form.key = item.key
    form.models = item.models.map((m) => ({ ...m }))
  }
}

// 初始化：数据加载完成后选中第一个
watch(
  () => store.items.length,
  (len) => {
    if (!selectedId.value && !isCreating.value && len > 0) {
      selectItem(store.items[0].id)
    }
  },
  { immediate: true }
)

const saving = ref(false)

async function handleSave() {
  if (!form.name) {
    MessageUtil.warning('请输入提供方名称')
    return
  }
  if (!form.baseUrl) {
    MessageUtil.warning('请输入接口地址')
    return
  }
  if (!form.key) {
    MessageUtil.warning('请输入密钥')
    return
  }
  saving.value = true
  try {
    await store.put({
      id: form.id || undefined,
      name: form.name,
      baseUrl: form.baseUrl,
      key: form.key,
      models: form.models
    })
    // 新增完成后，选中刚刚保存的项，退出创建模式
    if (isCreating.value) {
      // 新增完成后，选中刚刚保存的项
      const added = store.items.find(
        (item) => item.name === form.name && item.baseUrl === form.baseUrl
      )
      if (added) selectItem(added.id)
      isCreating.value = false
    }
    MessageUtil.success('保存成功')
  } catch (e) {
    MessageUtil.error('保存失败: ' + (e as Error).message)
  } finally {
    saving.value = false
  }
}

// ---------- 提供方名称预设 ----------

const providerPresets: Array<{ label: string; baseUrl: string }> = [
  { label: 'V3 API', baseUrl: 'https://api.vveai.com/v1' },
  { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1' },
  { label: 'Ollama (本地)', baseUrl: 'http://localhost:11434/v1' },
  { label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1' },
  { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1' },
  { label: 'Together AI', baseUrl: 'https://api.together.xyz/v1' },
  { label: 'Mistral AI', baseUrl: 'https://api.mistral.ai/v1' },
  { label: 'Perplexity', baseUrl: 'https://api.perplexity.ai' },
  { label: '零一万物 (Yi)', baseUrl: 'https://api.lingyiwanwu.com/v1' },
  { label: 'Moonshot (月之暗面)', baseUrl: 'https://api.moonshot.cn/v1' },
  {
    label: '阿里云 (通义千问)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  },
  { label: '百度千帆', baseUrl: 'https://qianfan.baobao.baidu.com/v2' },
  { label: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1' },
  { label: '小米', baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1' }
]

const namePresets = providerPresets.map((p) => ({
  label: p.label,
  value: p.label
}))

function onNameChange(value: any) {
  if (typeof value === 'string' && value) {
    const matched = providerPresets.find((p) => p.label === value)
    if (matched) {
      form.baseUrl = matched.baseUrl
      return
    }
  }
}

// ---------- 新增提供方 ----------

function handleAdd() {
  isCreating.value = true
  form.id = ''
  form.name = ''
  form.baseUrl = ''
  form.key = ''
  form.models = []
  selectedId.value = ''
}

// ---------- 删除提供方 ----------

async function handleDelete(id: string) {
  await store.remove(id)
  if (selectedId.value === id) {
    if (store.items.length > 0) {
      selectItem(store.items[0].id)
    } else {
      selectedId.value = ''
    }
  }
}

// ---------- 模型分组 ----------

function getModelFamily(id: string): string {
  return id.split(/[-_.\d]/).filter(Boolean)[0] || id
}

const modelGroups = computed(() => {
  const map = new Map<string, AiModel[]>()
  for (const m of form.models) {
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

// ---------- 手动添加模型 ----------

function handleAddModel() {
  openModelDialog(
    form.models.map((m) => m.identifier),
    async (result) => {
      form.models.push({
        identifier: result.identifier,
        model: result.name,
        type: result.type,
        enable: true,
      })
      await handleSave()
      MessageUtil.success('模型已添加')
    }
  )
}

function handleEditModel(model: AiModel) {
  openModelDialog(
    form.models.map((m) => m.identifier),
    async (result) => {
      const target = form.models.find((m) => m.identifier === model.identifier)
      if (target) {
        target.model = result.name
        target.type = result.type
      }
      await handleSave()
      MessageUtil.success('模型已更新')
    },
    model
  )
}

// ---------- 删除模型 ----------

async function handleDeleteModel(row: AiModel) {
  const index = form.models.findIndex((m) => m.identifier === row.identifier)
  if (index > -1) {
    form.models.splice(index, 1)
    await handleSave()
  }
}

async function handleModelEnableChange(row: AiModel, val: boolean) {
  const model = form.models.find((m) => m.identifier === row.identifier)
  if (model) {
    model.enable = val
    await handleSave()
  }
}

// ---------- 从接口获取模型 ----------

const fetching = ref(false)

async function handleFetchModels() {
  if (!form.baseUrl || !form.key) {
    MessageUtil.warning('请先填写接口地址和密钥')
    return
  }
  fetching.value = true
  try {
    const client = new OpenAI({
      baseURL: form.baseUrl,
      apiKey: form.key,
      dangerouslyAllowBrowser: true
    })
    const response = await client.models.list()
    const data = response.data || []
    const fetched = data.map((m: { id: string; owned_by?: string }) => ({
      id: m.id,
      name: m.id
    }))
    fetchModelsDrawer(fetched, form.models, async (selectedIds: string[]) => {
      form.models = []
      for (const m of fetched) {
        form.models.push({
          identifier: m.id,
          model: m.name,
          // TODO：确定模型类型
          type: 'chat',
          enable: selectedIds.includes(m.id)
        })
      }
      await handleSave()
      MessageUtil.success('模型已更新')
    })
  } catch (e) {
    MessageUtil.error('获取模型失败: ' + (e as Error).message)
  } finally {
    fetching.value = false
  }
}
</script>

<style scoped lang="less">
.ai-setting-layout {
  display: flex;
  height: calc(100vh - 57px);
  gap: 16px;
}

// 左侧：提供方列表
.ai-setting-sidebar {
  width: 232px;
  min-width: 232px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--td-border-level-1-color);
  padding-right: 16px;
  transition: all 0.3s ease-in-out;

  &__header {
    width: 232px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    padding-right: 8px;
  }

  &__title {
    font-size: 16px;
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  &__list {
    width: 232px;
    min-width: 232px;
    flex: 1;
    overflow-y: auto;
    padding: 0 8px;
  }

  &__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-radius: var(--td-radius-default);
    transition: background-color 0.2s;
    margin-bottom: 4px;

    &:hover {
      background-color: var(--td-bg-color-secondaryhover);
    }

    &.is-active {
      background-color: var(--td-brand-color-light);
    }
  }

  &__item-content {
    flex: 1;
    cursor: pointer;
  }

  &__item-name {
    font-size: 14px;
    color: var(--td-text-color-primary);
  }
}

// 右侧：编辑面板
.ai-setting-main {
  flex: 1;
  overflow-y: auto;
  min-width: 0;
  padding-right: 24px;
  padding-bottom: 24px;
  z-index: 1;
}

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

.text-muted {
  color: var(--td-text-color-placeholder);
}
</style>
