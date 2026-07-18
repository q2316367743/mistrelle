<template>
  <page-layout title="提示词管理">
    <template #extra>
      <t-button theme="primary" @click="openPromptPut(undefined, activeType)">
        <template #icon><AddIcon /></template>
        新增提示词
      </t-button>
    </template>
    <t-tabs v-model:value="activeType" class="primpt-tabs">
      <t-tab-panel
        v-for="tab in typeOptions"
        :key="tab.value"
        :value="tab.value"
        :label="tab.label"
      >
        <div v-if="filteredList(tab.value).length > 0" class="primpt-list">
          <t-card
            v-for="item in filteredList(tab.value)"
            :key="item.id"
            size="small"
            hover-shadow
            class="primpt-card"
            :title="item.name"
            @click="handleChat(item)"
            @contextmenu="openPromptContextmenu($event, item.id)"
          >
            <div class="primpt-card__content">
              <div v-if="item.description" class="primpt-card__desc">
                {{ item.description }}
              </div>
            </div>
            <template #actions>
              <t-tag theme="primary" variant="light" size="small">
                {{ typeLabel(item.type) }}
              </t-tag>
            </template>
          </t-card>
        </div>
        <t-empty v-else description="暂无该类型提示词" class="mt-15vh" />
      </t-tab-panel>
    </t-tabs>
  </page-layout>
</template>

<script lang="ts" setup>
import { useAiPromptStore } from '@/store'
import { openPromptPut, openPromptContextmenu } from './modals/prompt-func'
import { AddIcon } from 'tdesign-icons-vue-next'
import { AiPromptItem, AiPromptType, typeOptions } from '@/entity/ai'

const router = useRouter()
const store = useAiPromptStore()

const activeType = ref<AiPromptType>(typeOptions[0].value)

const filteredList = (type: AiPromptType) => {
  return store.state.filter((item) => item.type === type)
}

const typeLabel = (type: AiPromptType): string => {
  return typeOptions.find((t) => t.value === type)?.label || type
}

const handleChat = (primpt: AiPromptItem) => {
  router.push(`/new/primpt/${primpt.id}`)
}
</script>

<style scoped lang="less">
.primpt-tabs {
  height: 100%;
}

.primpt-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  padding: 16px;
}

.primpt-card {
  cursor: pointer;
  user-select: none;
}

.primpt-card__content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.primpt-card__name {
  font-size: 16px;
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.primpt-card__desc {
  font-size: 13px;
  color: var(--td-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
