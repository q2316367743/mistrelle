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
        <t-list v-if="filteredList(tab.value).length > 0" class="primpt-list" split>
          <t-list-item
            v-for="item in filteredList(tab.value)"
            :key="item.id"
            size="small"
            hover-shadow
            class="primpt-card"
          >
            <t-list-item-meta :title="item.name" :description="item.description"></t-list-item-meta>
            <template #action>
              <t-space size="small">
                <t-button
                  theme="primary"
                  variant="text"
                  shape="square"
                  @click="openPromptPut(item.id)"
                >
                  <template #icon>
                    <EditIcon />
                  </template>
                </t-button>
                <t-popconfirm content="确定删除该提示词？" @confirm="openPromptDelete(item.id)">
                  <t-button theme="danger" variant="text" shape="square">
                    <template #icon>
                      <DeleteIcon />
                    </template>
                  </t-button>
                </t-popconfirm>
              </t-space>
            </template>
          </t-list-item>
        </t-list>
        <t-empty v-else description="暂无该类型提示词" class="mt-15vh" />
      </t-tab-panel>
    </t-tabs>
  </page-layout>
</template>

<script lang="ts" setup>
import { useAiPromptStore } from '@/store'
import { openPromptPut } from './modals/prompt-func'
import { AddIcon, DeleteIcon, EditIcon } from 'tdesign-icons-vue-next'
import { AiPromptType, typeOptions } from '@/entity/ai'
import { MessageUtil } from '@/utils/modal'

const store = useAiPromptStore()

const activeType = ref<AiPromptType>(typeOptions[0].value)

const filteredList = (type: AiPromptType) => {
  return store.state.filter((item) => item.type === type)
}

const openPromptDelete = (id: string) => {
  useAiPromptStore()
    .remove(id)
    .then(() => {
      MessageUtil.success('删除成功')
    })
    .catch((e) => MessageUtil.error('删除失败', e))
}
</script>

<style scoped lang="less">
.primpt-tabs {
  height: 100%;
}

.primpt-list {
  width: 100%;
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
