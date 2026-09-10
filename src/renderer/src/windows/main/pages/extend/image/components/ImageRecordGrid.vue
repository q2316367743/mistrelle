<template>
  <div class="record-view">
    <div class="view-toolbar">
      <t-input v-model="keywordModel" class="search-input" clearable placeholder="搜索提示词…">
        <template #prefix-icon><SearchIcon /></template>
      </t-input>
      <span class="count-text">共 {{ total }} 张</span>
    </div>

    <div v-if="initLoading" class="init-loading">
      <t-loading size="small" />
    </div>

    <template v-else>
      <div v-if="items.length" class="record-scroll">
        <div class="record-grid">
          <image-record-card
            v-for="item in items"
            :key="item.id"
            :item="item"
            @open="(record) => emit('open', record)"
            @retry="(record) => emit('retry', record)"
            @delete="(record) => emit('delete', record)"
          />
        </div>

        <div v-if="hasMore" class="load-more">
          <t-button variant="dashed" :loading="moreLoading" @click="emit('load-more')">
            加载更多
          </t-button>
        </div>
      </div>

      <empty-result v-else-if="keyword" title="未找到匹配的生成记录" tip="换个关键词试试" />
      <empty-result v-else title="还没有生成记录" tip="在上方输入提示词，生成第一张图片吧" />
    </template>
  </div>
</template>

<script lang="ts" setup>
import { SearchIcon } from 'tdesign-icons-vue-next'
import EmptyResult from '@/components/Result/EmptyResult.vue'
import ImageRecordCard from './ImageRecordCard.vue'

const props = defineProps<{
  // eslint-disable-next-line no-undef
  items: ImageRecordInput[]
  total: number
  initLoading: boolean
  moreLoading: boolean
  hasMore: boolean
  keyword: string
}>()

const emit = defineEmits<{
  'update:keyword': [value: string]
  // eslint-disable-next-line no-undef
  open: [record: ImageRecordInput]
  // eslint-disable-next-line no-undef
  retry: [record: ImageRecordInput]
  // eslint-disable-next-line no-undef
  delete: [record: ImageRecordInput]
  'load-more': []
}>()

const keywordModel = computed({
  get: () => props.keyword,
  set: (value: string) => emit('update:keyword', value)
})
</script>

<style scoped lang="less">
.record-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.view-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.search-input {
  width: 260px;
}

.count-text {
  font-size: 13px;
  color: var(--td-text-color-secondary);
}

.init-loading {
  display: flex;
  justify-content: center;
  padding: 48px 0;
  flex-shrink: 0;
}

.record-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.record-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  align-items: stretch;
  width: 100%;
}

.load-more {
  display: flex;
  justify-content: center;
  padding: 16px 0 8px;
}

:deep(.empty-result-container) {
  height: auto;
  min-height: 240px;
}
</style>
