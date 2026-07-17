<template>
  <page-layout title="提示词管理">
    <template #extra>
      <t-button theme="primary" @click="openFriendPut(undefined, activeType)">
        <template #icon><AddIcon /></template>
        新增提示词
      </t-button>
    </template>
    <t-tabs v-model:value="activeType" class="friend-tabs">
      <t-tab-panel
        v-for="tab in typeOptions"
        :key="tab.value"
        :value="tab.value"
        :label="tab.label"
      >
        <div v-if="filteredList(tab.value).length > 0" class="friend-list">
          <t-card
            v-for="item in filteredList(tab.value)"
            :key="item.id"
            size="small"
            hover-shadow
            class="friend-card"
            :title="item.name"
            @click="handleChat(item)"
            @contextmenu="openFriendContextmenu($event, item.id)"
          >
            <div class="friend-card__content">
              <div v-if="item.description" class="friend-card__desc">
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
        <t-empty v-else description="暂无该类型好友" class="mt-15vh" />
      </t-tab-panel>
    </t-tabs>
  </page-layout>
</template>

<script lang="ts" setup>
import { useAiFriendStore } from '@/store'
import { openFriendPut, openFriendContextmenu } from './modals/friend-func'
import { AddIcon } from 'tdesign-icons-vue-next'
import { AiFriendItem, AiFriendType, typeOptions } from '@/entity/ai'

const router = useRouter()
const store = useAiFriendStore()

const activeType = ref<AiFriendType>(typeOptions[0].value)

const filteredList = (type: AiFriendType) => {
  return store.state.filter((item) => item.type === type)
}

const typeLabel = (type: AiFriendType): string => {
  return typeOptions.find((t) => t.value === type)?.label || type
}

const handleChat = (friend: AiFriendItem) => {
  router.push(`/new/friend/${friend.id}`)
}
</script>

<style scoped lang="less">
.friend-tabs {
  height: 100%;
}

.friend-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  padding: 16px;
}

.friend-card {
  cursor: pointer;
  user-select: none;
}

.friend-card__content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.friend-card__name {
  font-size: 16px;
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.friend-card__desc {
  font-size: 13px;
  color: var(--td-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
