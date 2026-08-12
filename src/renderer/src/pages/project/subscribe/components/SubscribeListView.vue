<template>
  <div class="subscribe-list">
    <div class="subscribe-list__header">
      <span class="subscribe-list__title">{{ blogger.name }}</span>
      <t-tag size="small" variant="light">{{ items.length }} 条</t-tag>
      <div class="subscribe-list__actions">
        <t-tooltip content="识别设置">
          <t-button variant="text" shape="square" @click="emit('setting', blogger)">
            <template #icon><SettingIcon /></template>
          </t-button>
        </t-tooltip>
        <t-tooltip content="同步视频（每次新增 10 条）">
          <t-button variant="text" shape="square" :loading="syncing" @click="handleSync">
            <template #icon><RefreshIcon /></template>
          </t-button>
        </t-tooltip>
      </div>
    </div>

    <div class="subscribe-list__body">
      <t-empty
        v-if="items.length === 0"
        title="暂无订阅"
        description="点击右上角同步视频"
        class="mt-25vh"
      />
      <div
        v-for="item in items"
        :key="item.id"
        class="subscribe-item"
        :class="{ 'is-active': item.id === selectedId }"
        @click="emit('select', item)"
      >
        <img
          v-if="item.cover"
          :src="item.cover"
          class="subscribe-item__cover"
          referrerpolicy="no-referrer"
        />
        <div v-else class="subscribe-item__cover subscribe-item__cover--empty">
          <VideoIcon size="20px" />
        </div>
        <div class="subscribe-item__info">
          <span class="subscribe-item__title">{{ item.title }}</span>
          <span class="subscribe-item__date">{{ item.publishDate || '' }}</span>
        </div>
        <t-tag :theme="SUBSCRIBE_STATUS_META[item.status].theme" size="small" variant="light">
          {{ SUBSCRIBE_STATUS_META[item.status].label }}
        </t-tag>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { RefreshIcon, SettingIcon, VideoIcon } from 'tdesign-icons-vue-next'
import type { SubscribeBlogger, SubscribeItem } from '@/entity/project/Subscribe'
import { subscribeBloggerSyncVideos } from '@/modules/subscribe'
import { SUBSCRIBE_STATUS_META } from '@/modules/subscribe'
import { MessageUtil } from '@/utils/modal'

const props = defineProps<{
  projectId: string
  blogger: SubscribeBlogger
  items: SubscribeItem[]
  selectedId?: string
}>()

const emit = defineEmits<{
  (e: 'select', item: SubscribeItem): void
  (e: 'setting', blogger: SubscribeBlogger): void
  (e: 'refresh'): void
}>()

const syncing = ref(false)

const handleSync = async () => {
  syncing.value = true
  try {
    await subscribeBloggerSyncVideos(props.projectId, props.blogger.id)
    MessageUtil.success('同步完成')
    emit('refresh')
  } catch (e) {
    MessageUtil.error('同步失败', e)
  } finally {
    syncing.value = false
  }
}
</script>
<style scoped lang="less">
.subscribe-list {
  display: flex;
  flex-direction: column;
  height: 100%;

  &__header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    flex-shrink: 0;
  }

  &__title {
    font: var(--td-font-title-medium);
    color: var(--td-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__body {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }
}

.subscribe-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: var(--td-radius-medium);
  cursor: pointer;
  transition: background-color var(--fluent-transition-fast);

  &:hover {
    background-color: var(--td-bg-color-container-hover);
  }

  &.is-active {
    background-color: var(--td-brand-color-light);
  }

  &__cover {
    width: 96px;
    height: 56px;
    border-radius: var(--td-radius-small);
    object-fit: cover;
    flex-shrink: 0;
    background-color: var(--td-bg-color-component);

    &--empty {
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--td-text-color-placeholder);
    }
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  &__title {
    font: var(--td-font-body-medium);
    color: var(--td-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__date {
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
  }
}
</style>
