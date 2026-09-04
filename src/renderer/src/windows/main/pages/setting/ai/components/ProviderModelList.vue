<template>
  <div class="model-section">
    <div class="model-section__header">
      <span class="model-section__title">模型列表</span>
      <t-button v-if="!readonly" size="small" @click="emit('add')">
        <template #icon><AddIcon /></template>
        添加模型
      </t-button>
    </div>
    <t-input
      v-model="keyword"
      clearable
      placeholder="搜索模型 ID 或名称"
      class="model-section__search"
    >
      <template #prefixIcon>
        <SearchIcon />
      </template>
    </t-input>

    <template v-if="models.length > 0">
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
                :value="readonly ? true : model.enable"
                :disabled="readonly"
                @change="(val: boolean | string | number) => emit('toggle', model, Boolean(val))"
              />
              <template v-if="!readonly">
                <t-button
                  theme="primary"
                  variant="text"
                  size="small"
                  shape="square"
                  @click="emit('edit', model)"
                >
                  <template #icon><EditIcon /></template>
                </t-button>
                <t-button
                  theme="danger"
                  variant="text"
                  size="small"
                  shape="square"
                  @click="emit('delete', model)"
                >
                  <template #icon><DeleteIcon /></template>
                </t-button>
              </template>
            </div>
          </div>
        </div>
      </template>
      <t-empty v-if="modelGroups.length === 0" description="未找到匹配的模型" class="mt-12px" />
    </template>
    <t-empty v-else :description="emptyText" class="mt-12px" />
  </div>
</template>

<script lang="ts" setup>
import { AddIcon, DeleteIcon, EditIcon, SearchIcon } from 'tdesign-icons-vue-next'
import type { AiModel } from '@/entity'
import { MODEL_TYPE_LABEL, MODEL_TYPE_THEME } from '@/utils/aiModel'

const props = withDefaults(
  defineProps<{
    models: AiModel[]
    readonly?: boolean
    emptyText?: string
  }>(),
  {
    readonly: false,
    emptyText: '暂无模型，请从接口获取或手动添加'
  }
)

const emit = defineEmits<{
  add: []
  edit: [model: AiModel]
  delete: [model: AiModel]
  toggle: [model: AiModel, val: boolean]
}>()

const keyword = ref('')

function getModelFamily(id: string): string {
  return id.split(/[-_.\d]/).filter(Boolean)[0] || id
}

const modelGroups = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  const list = kw
    ? props.models.filter(
        (m) => m.identifier.toLowerCase().includes(kw) || (m.model || '').toLowerCase().includes(kw)
      )
    : props.models
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
.model-section {
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__title {
    font: var(--td-font-title-small);
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  &__search {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--fluent-card-bg);
    padding: 12px 0;
  }
}

.model-group {
  margin-top: 16px;

  &__title {
    font: var(--td-font-body-medium);
    font-weight: 600;
    color: var(--td-text-color-primary);
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--td-component-stroke);
  }
}

.model-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: var(--fluent-radius-smooth);
  transition: background-color var(--fluent-transition-fast);

  &:hover {
    background-color: var(--fluent-item-hover);
  }

  &__info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }

  &__name {
    font: var(--td-font-body-small);
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
