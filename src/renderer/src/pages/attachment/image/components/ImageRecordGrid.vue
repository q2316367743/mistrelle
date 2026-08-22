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
      <div v-if="items.length" class="record-grid">
        <div
          v-for="item in items"
          :key="item.id"
          class="record-card"
          :class="{ 'is-failed': item.status === 'failed' }"
          @click="handleCardClick(item)"
        >
          <div class="card-media">
            <t-image
              v-if="item.status === 'success' && item.path"
              :src="pathToHref(item.path)"
              :alt="item.prompt"
              fit="cover"
              class="card-image"
            />
            <div v-else class="card-skeleton">
              <t-loading v-if="item.status === 'pending'" size="small" />
              <ErrorCircleFilledIcon v-else class="fail-icon" />
              <span class="skeleton-hint">
                {{ item.status === 'pending' ? '生成中…' : '生成失败' }}
              </span>
            </div>
            <span v-if="item.size" class="card-size">{{ item.size }}</span>
          </div>
          <div class="card-body">
            <p class="card-prompt">{{ item.prompt }}</p>
            <div class="card-meta">
              <span class="card-time">{{ formatDateTime(item.createdAt) }}</span>
              <span v-if="item.model" class="card-model">{{ item.model }}</span>
            </div>
            <p v-if="item.status === 'failed' && item.error" class="card-error" :title="item.error">
              {{ item.error }}
            </p>
            <div class="card-actions">
              <t-button
                v-if="item.status === 'failed'"
                size="small"
                theme="primary"
                variant="outline"
                @click.stop="emit('retry', item)"
              >
                <template #icon><RefreshIcon /></template>
                重试
              </t-button>
              <t-button
                v-else
                size="small"
                variant="text"
                theme="primary"
                @click.stop="emit('open', item)"
              >
                查看详情
              </t-button>
            </div>
          </div>
        </div>
      </div>

      <empty-result v-else-if="keyword" title="未找到匹配的生成记录" tip="换个关键词试试" />
      <empty-result v-else title="还没有生成记录" tip="在上方输入提示词，生成第一张图片吧" />

      <div v-if="hasMore" class="load-more">
        <t-button variant="dashed" :loading="moreLoading" @click="emit('load-more')">
          加载更多
        </t-button>
      </div>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { ErrorCircleFilledIcon, RefreshIcon, SearchIcon } from 'tdesign-icons-vue-next'
import EmptyResult from '@/components/Result/EmptyResult.vue'
import { formatDateTime, pathToHref } from '../image-page-utils'

const props = defineProps<{
  items: ImageRecordInput[]
  total: number
  initLoading: boolean
  moreLoading: boolean
  hasMore: boolean
  keyword: string
}>()

const emit = defineEmits<{
  'update:keyword': [value: string]
  open: [record: ImageRecordInput]
  retry: [record: ImageRecordInput]
  'load-more': []
}>()

const keywordModel = computed({
  get: () => props.keyword,
  set: (value: string) => emit('update:keyword', value)
})

const handleCardClick = (item: ImageRecordInput) => {
  if (item.status === 'success') emit('open', item)
}
</script>

<style scoped lang="less">
.record-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.view-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
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
}

.record-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  /* 容器被 flex 撑高时，行按内容高度顶部排列，避免单卡片被 align-content:stretch 拉满 */
  align-content: start;
  max-height: 100%;
  overflow-y: auto;
}

.record-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--td-component-border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--td-bg-color-container);
  transition: box-shadow 0.2s ease;
  cursor: pointer;

  &:hover {
    box-shadow: var(--td-shadow-2);
  }

  &.is-failed {
    border-color: var(--td-error-color-3);
  }
}

.card-media {
  position: relative;
  aspect-ratio: 1;
  background: var(--td-bg-color-component);

  .card-image {
    width: 100%;
    height: 100%;
  }
}

.card-skeleton {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100%;
  color: var(--td-text-color-placeholder);
}

.skeleton-hint {
  font-size: 13px;
}

.fail-icon {
  font-size: 28px;
  color: var(--td-error-color);
}

.card-size {
  position: absolute;
  right: 8px;
  bottom: 8px;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
  background: var(--td-mask-active);
  color: var(--td-text-color-primary);
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px 12px;
}

.card-prompt {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
  font-size: 13px;
  color: var(--td-text-color-primary);
  line-height: 1.5;
}

.card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.card-time {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}

.card-model {
  max-width: 50%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}

.card-error {
  margin: 0;
  font-size: 12px;
  color: var(--td-error-color);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
}

.load-more {
  display: flex;
  justify-content: center;
  padding: 8px 0;
}

:deep(.empty-result-container) {
  height: auto;
  min-height: 240px;
}
</style>
