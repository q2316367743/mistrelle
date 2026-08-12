<template>
  <page-layout title="专家">
    <template #extra>
      <div class="flex gap-8px items-center">
        <t-input
          v-model="keyword"
          clearable
          placeholder="搜索专家名称、描述..."
          class="agent-page__search"
        >
          <template #prefix-icon>
            <search-icon />
          </template>
        </t-input>
        <t-button theme="primary" @click="handleAdd">
          <template #icon><AddIcon /></template>
          新增专家
        </t-button>
      </div>
    </template>

    <div class="agent-page">
      <div class="agent-page__toolbar">
        <t-tabs v-model="categoryTab" class="agent-page__tabs">
          <t-tab-panel value="" label="全部" />
          <t-tab-panel
            v-for="c in AI_AGENT_CATEGORIES"
            :key="c.value"
            :value="c.value"
            :label="c.label"
          />
        </t-tabs>
        <div class="agent-page__spacer" />
      </div>
      <div class="agent-page__body">
        <div v-if="filteredList.length > 0" class="agent-page__grid">
          <agent-card
            v-for="item in filteredList"
            :key="item.id"
            :agent="item"
            @preview="handlePreview(item.id)"
            @edit="handleEdit(item.id)"
            @delete="handleDelete(item.id)"
          />
        </div>
        <t-empty
          v-else
          title="暂无专家"
          description="点击右上角新增专家"
          class="agent-page__empty"
        />
      </div>
    </div>
  </page-layout>
</template>

<script lang="ts" setup>
import { AddIcon, SearchIcon } from 'tdesign-icons-vue-next'
import { useAiAgentStore } from '@/store'
import { openAgentPut, openAgentPreview } from '@/pages/app/agent-func'
import { MessageUtil } from '@/utils/modal'
import { AI_AGENT_CATEGORIES } from '@/entity/ai'
import AgentCard from './components/AgentCard.vue'

const store = useAiAgentStore()
const keyword = ref('')
const categoryTab = ref('')

const filteredList = computed(() => {
  let list = store.all
  if (categoryTab.value) {
    list = list.filter((item) => item.category === categoryTab.value)
  }
  const text = keyword.value.trim().toLowerCase()
  if (!text) return list
  return list.filter(
    (item) =>
      item.name.toLowerCase().includes(text) || item.description.toLowerCase().includes(text)
  )
})

const handleAdd = () => openAgentPut()
const handlePreview = (id: string) => openAgentPreview(id)
const handleEdit = (id: string) => openAgentPut(id)

const handleDelete = (id: string) => {
  store
    .remove(id)
    .then(() => MessageUtil.success('删除成功'))
    .catch((e) => MessageUtil.error('删除失败', e))
}
</script>

<style scoped lang="less">
.agent-page__search {
  width: 240px;
}
.agent-page {
  display: flex;
  flex-direction: column;
  height: calc(100% - 8px);
  padding: 0 8px 8px;
  overflow: auto;

  &__spacer {
    flex: 1;
    min-width: 8px;
  }

  &__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    margin-top: 8px;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
  }

  &__empty {
    margin-top: 15vh;
  }
}
</style>
