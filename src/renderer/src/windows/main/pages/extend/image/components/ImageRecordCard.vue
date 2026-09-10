<template>
  <div
    class="record-card"
    :class="{ 'is-failed': item.status === 'failed' }"
    @click="handleClick"
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
      <!-- 多图角标：一次任务出多张（n>1） -->
      <span v-if="item.images.length > 1" class="card-count">×{{ item.images.length }}</span>
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
      <p v-if="item.status === 'failed' && item.error" class="card-error" :title="item.error">
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
          @click.stop="handleDelete"
        >
          <template #icon><DeleteIcon /></template>
        </t-button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { DeleteIcon, ErrorCircleFilledIcon, RefreshIcon } from 'tdesign-icons-vue-next'
import { MessageBoxUtil } from '@/utils/modal'
import { formatDateTime, isRetryableFailed, pathToHref } from '../image-page-utils'

const props = defineProps<{
  // eslint-disable-next-line no-undef
  item: ImageRecordInput
}>()

const emit = defineEmits<{
  open: [record: ImageRecordInput]
  retry: [record: ImageRecordInput]
  delete: [record: ImageRecordInput]
}>()

const handleClick = () => {
  // 成功卡看大图，失败卡看错误详情与删除/重试；生成中不可点
  if (props.item.status === 'success' || props.item.status === 'failed') emit('open', props.item)
}

const handleDelete = async () => {
  try {
    await MessageBoxUtil.confirm('确认删除这张生成记录？删除后不可恢复', '删除确认')
  } catch {
    return
  }
  emit('delete', props.item)
}
</script>

<style scoped lang="less">
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

.card-count {
  position: absolute;
  left: 8px;
  bottom: 8px;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
  background: var(--td-mask-active);
  color: var(--td-text-color-primary);
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
</style>
