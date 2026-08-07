<template>
  <div class="fetch-models-content">
    <div class="fetch-models-content__search">
      <t-input v-model="keyword" clearable placeholder="搜索模型 ID 或名称">
        <template #prefixIcon>
          <SearchIcon />
        </template>
      </t-input>
    </div>

    <template v-if="fetchedModels.length > 0">
      <div class="fetch-models-content__toolbar">
        <t-checkbox
          :checked="allVisibleSelected"
          :indeterminate="someVisibleSelected && !allVisibleSelected"
          @change="handleSelectAll"
        >
          全选
        </t-checkbox>
        <span class="fetch-models-content__count">已选 {{ selectedIds.length }} / {{ visibleModels.length }}</span>
      </div>
      <div class="fetch-models-content__divider" />

      <div v-for="group in visibleGroups" :key="group.family" class="fetch-models-content__group">
        <div class="fetch-models-content__group-title">{{ group.family }}</div>
        <t-checkbox
          :checked="group.models.every((m) => selectedIds.includes(m.id))"
          :indeterminate="group.models.some((m) => selectedIds.includes(m.id)) && !group.models.every((m) => selectedIds.includes(m.id))"
          @change="(checked: boolean) => handleGroupChange(group, checked)"
        >
          全选
        </t-checkbox>
        <div class="fetch-models-content__group-models">
          <t-checkbox-group v-model="selectedIds">
            <t-checkbox
              v-for="m in group.models"
              :key="m.id"
              :value="m.id"
              class="fetch-models-content__item"
            >
              <t-tag
                v-if="guessModelType(m.id) !== 'chat'"
                size="small"
                variant="light"
                :theme="MODEL_TYPE_THEME[guessModelType(m.id)]"
              >
                {{ MODEL_TYPE_LABEL[guessModelType(m.id)] }}
              </t-tag>
              <span class="fetch-models-content__item-label">
                {{ m.id }}{{ m.name ? ` (${m.name})` : '' }}
              </span>
            </t-checkbox>
          </t-checkbox-group>
        </div>
      </div>
      <t-empty v-if="visibleGroups.length === 0" description="未找到匹配的模型" />
    </template>
    <t-empty v-else description="未获取到模型数据" />

    <div class="fetch-models-content__actions">
      <t-button variant="outline" @click="emit('close')">取消</t-button>
      <t-button
        theme="primary"
        :disabled="selectedIds.length === 0"
        :loading="submitting"
        @click="handleSubmit"
      >
        导入选中
      </t-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { SearchIcon } from 'tdesign-icons-vue-next'
import type { AiModel } from '@/entity'
import { MODEL_TYPE_LABEL, MODEL_TYPE_THEME, guessModelType } from '@/utils/aiModel'

interface FetchModel {
  id: string
  name: string
}

interface ModelGroup {
  family: string
  models: FetchModel[]
}

const props = defineProps<{
  fetchedModels: FetchModel[]
  existingModels: AiModel[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success', ids: string[]): void
}>()

const selectedIds = ref<string[]>(props.existingModels.filter((m) => m.enable).map((m) => m.identifier))
const keyword = ref('')
const submitting = ref(false)

// ---------- 分组与过滤 ----------

function getModelFamily(id: string): string {
  return id.split(/[-_.\d]/).filter(Boolean)[0] || id
}

function groupModels(models: FetchModel[]): ModelGroup[] {
  const map = new Map<string, FetchModel[]>()
  for (const m of models) {
    const family = getModelFamily(m.id)
    if (!map.has(family)) map.set(family, [])
    map.get(family)!.push(m)
  }
  return Array.from(map.entries())
    .map(([family, items]) => ({
      family,
      models: items.sort((a, b) => a.id.localeCompare(b.id))
    }))
    .sort((a, b) => a.family.localeCompare(b.family))
}

const visibleGroups = computed<ModelGroup[]>(() => {
  const kw = keyword.value.trim().toLowerCase()
  const filtered = kw
    ? props.fetchedModels.filter(
        (m) => m.id.toLowerCase().includes(kw) || m.name.toLowerCase().includes(kw)
      )
    : props.fetchedModels
  return groupModels(filtered)
})

const visibleModels = computed<FetchModel[]>(() => visibleGroups.value.flatMap((g) => g.models))

const allVisibleSelected = computed(
  () => visibleModels.value.length > 0 && visibleModels.value.every((m) => selectedIds.value.includes(m.id))
)
const someVisibleSelected = computed(() => visibleModels.value.some((m) => selectedIds.value.includes(m.id)))

// ---------- 选择操作 ----------

function handleSelectAll(checked: boolean) {
  if (checked) {
    const toAdd = visibleModels.value.filter((m) => !selectedIds.value.includes(m.id)).map((m) => m.id)
    selectedIds.value = [...selectedIds.value, ...toAdd]
  } else {
    const visibleIds = visibleModels.value.map((m) => m.id)
    selectedIds.value = selectedIds.value.filter((id) => !visibleIds.includes(id))
  }
}

function handleGroupChange(group: ModelGroup, checked: boolean) {
  if (checked) {
    const toAdd = group.models.filter((m) => !selectedIds.value.includes(m.id)).map((m) => m.id)
    selectedIds.value = [...selectedIds.value, ...toAdd]
  } else {
    const groupIds = group.models.map((m) => m.id)
    selectedIds.value = selectedIds.value.filter((id) => !groupIds.includes(id))
  }
}

async function handleSubmit() {
  if (selectedIds.value.length === 0) return
  submitting.value = true
  try {
    emit('success', [...selectedIds.value])
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="less">
.fetch-models-content {
  &__search {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--td-bg-color-container);
    padding-bottom: 12px;
    margin-bottom: 8px;
  }

  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__count {
    font-size: 12px;
    color: var(--td-text-color-placeholder);
  }

  &__divider {
    height: 1px;
    background: var(--td-bg-color-component);
    margin: 12px 0;
  }

  &__group {
    margin-bottom: 12px;
  }

  &__group-title {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--td-text-color-primary);
  }

  &__group-models {
    margin-top: 4px;
  }

  &__item {
    display: flex;
    align-items: center;

    :deep(.t-checkbox__label) {
      display: flex;
      align-items: center;
      gap: 6px;
    }
  }

  &__item-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__actions {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}
</style>
