<template>
  <div class="blogger-list">
    <div class="blogger-list__header">
      <span class="blogger-list__title">博主</span>
      <t-button
        theme="primary"
        variant="text"
        shape="square"
        size="small"
        class="mr-8px"
        @click="emit('add')"
      >
        <template #icon><AddIcon /></template>
      </t-button>
    </div>

    <div class="blogger-list__body">
      <t-empty v-if="list.length === 0" title="暂无博主" description="点击右上角添加" class="mt-25vh" />
      <div
        v-for="b in list"
        :key="b.id"
        class="blogger-item"
        :class="{ 'is-active': b.id === selectedId }"
        @click="emit('select', b.id)"
      >
        <img
          v-if="b.avatar"
          :src="b.avatar"
          class="blogger-item__avatar"
          referrerpolicy="no-referrer"
        />
        <div v-else class="blogger-item__avatar blogger-item__avatar--empty">{{ b.name?.[0] }}</div>
        <div class="blogger-item__body">
          <span class="blogger-item__name">{{ b.name }}</span>
          <span class="blogger-item__count">{{ b.videoCount ?? 0 }} 条笔记</span>
        </div>
        <div class="blogger-item__actions" @click.stop>
          <t-tooltip content="识别设置">
            <t-button variant="text" shape="square" size="small" @click="emit('setting', b)">
              <template #icon><SettingIcon /></template>
            </t-button>
          </t-tooltip>
          <t-dropdown :popup-props="{ trigger: 'click' }">
            <t-button variant="text" shape="square" size="small">
              <template #icon><MoreIcon /></template>
            </t-button>
            <t-dropdown-menu>
              <t-dropdown-item theme="error" @click="emit('remove', b)">删除</t-dropdown-item>
            </t-dropdown-menu>
          </t-dropdown>
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { AddIcon, MoreIcon, SettingIcon } from 'tdesign-icons-vue-next'
import type { SubscribeBlogger } from '@/entity/project/Subscribe'

defineProps<{
  list: SubscribeBlogger[]
  selectedId?: string
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'add'): void
  (e: 'setting', blogger: SubscribeBlogger): void
  (e: 'remove', blogger: SubscribeBlogger): void
}>()
</script>
<style scoped lang="less">
.blogger-list {
  display: flex;
  flex-direction: column;
  height: 100%;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    height: 24px;
  }

  &__title {
    font: var(--td-font-title-medium);
    color: var(--td-text-color-primary);
  }

  &__body {
    flex: 1;
    overflow-y: auto;
    padding: 0 8px;
  }
}

.blogger-item {
  display: flex;
  align-items: center;
  gap: 10px;
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

  &__avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;

    &--empty {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      color: var(--td-text-color-primary);
      background-color: var(--td-brand-color-light);
    }
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  &__name {
    font: var(--td-font-body-medium);
    color: var(--td-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__count {
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
  }

  &__actions {
    display: flex;
    align-items: center;
    opacity: 0;
    transition: opacity var(--fluent-transition-fast);
    flex-shrink: 0;
  }

  &:hover &__actions {
    opacity: 1;
  }
}
</style>
