<template>
  <div class="builtin-panel">
    <div class="builtin-panel__header">
      <div>
        <div class="builtin-panel__name">{{ name }}</div>
        <div class="builtin-panel__desc">
          内置服务端中转供应商，模型列表来自服务端 /v1/models，按积分计费
        </div>
      </div>
      <t-button
        theme="primary"
        variant="outline"
        :loading="refreshing"
        :disabled="!signedIn"
        @click="emit('refresh')"
      >
        <template #icon><RefreshIcon /></template>
        刷新模型列表
      </t-button>
    </div>
    <t-divider />
    <div class="model-section">
      <div class="model-section__header">
        <span class="model-section__title">模型列表</span>
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

      <template v-if="!signedIn">
        <t-empty description="登录后可获取内置模型列表" style="margin-top: 12px" />
      </template>
      <template v-else-if="models.length > 0">
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
                <t-switch :value="true" disabled />
              </div>
            </div>
          </div>
        </template>
        <t-empty v-if="modelGroups.length === 0" description="未找到匹配的模型" style="margin-top: 12px" />
      </template>
      <t-empty v-else description="暂无模型，点击右上角刷新" style="margin-top: 12px" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { RefreshIcon, SearchIcon } from 'tdesign-icons-vue-next'
import type { AiModel } from '@/entity'
import { MODEL_TYPE_LABEL, MODEL_TYPE_THEME } from '@/utils/aiModel'

const props = defineProps<{
  name: string
  models: AiModel[]
  refreshing: boolean
  signedIn: boolean
}>()

const emit = defineEmits<{
  refresh: []
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
.builtin-panel {
  &__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  &__name {
    font-size: 18px;
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  &__desc {
    font-size: 13px;
    color: var(--td-text-color-secondary);
    margin-top: 4px;
  }
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
