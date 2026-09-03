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
                <span v-if="item.model || item.styleName" class="card-model">
                  {{ [item.model, item.styleName].filter((v) => !!v).join(' · ') }}
                </span>
              </div>
              <p
                v-if="item.status === 'failed' && item.error"
                class="card-error"
                :title="item.error"
              >
                {{ item.error }}
              </p>
              <div class="card-actions">
                <t-button
                  v-if="isRetryableFailed(item)"
                  size="small"
                  theme="primary"
                  variant="outline"
                  @click.stop="emit('retry', item)"
                >
                  <template #icon><RefreshIcon /></template>
                  重试
                </t-button>
                <t-button
                  v-if="item.status === 'failed'"
                  class="delete-btn"
                  size="small"
                  shape="square"
                  theme="danger"
                  variant="text"
                  title="删除记录"
                  @click.stop="handleDelete(item)"
                >
                  <template #icon><DeleteIcon /></template>
                </t-button>
              </div>
            </div>
          </div>
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
import { DeleteIcon, ErrorCircleFilledIcon, RefreshIcon, SearchIcon } from 'tdesign-icons-vue-next'
import EmptyResult from '@/components/Result/EmptyResult.vue'
import { MessageBoxUtil } from '@/utils/modal'
import { formatDateTime, isRetryableFailed, pathToHref } from '../image-page-utils'

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

// eslint-disable-next-line no-undef
const handleCardClick = (item: ImageRecordInput) => {
  // 成功卡看大图，失败卡看错误详情与删除/重试；生成中不可点
  if (item.status === 'success' || item.status === 'failed') emit('open', item)
}

// eslint-disable-next-line no-undef
const handleDelete = async (item: ImageRecordInput) => {
  try {
    await MessageBoxUtil.confirm('确认删除这张生成记录？删除后不可恢复', '删除确认')
  } catch {
    return
  }
  emit('delete', item)
}
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
  width: 100%;
  /* padding-top 撑出正方形：高 = 卡片内容宽度，几何上无条件 1:1，比 aspect-ratio 更稳（不受 grid 拉伸影响） */
  padding-top: 100%;
  background: var(--td-bg-color-component);

  .card-image,
  .card-skeleton {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
}

.card-skeleton {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
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
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
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
