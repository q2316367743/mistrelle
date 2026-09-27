<template>
  <div class="xhs-files">
    <div class="xhs-files__bar">
      <span class="xhs-files__hint">点击条目在文件夹中显示</span>
      <t-button
        theme="primary"
        variant="text"
        shape="square"
        title="刷新"
        :loading="loading"
        @click="handleRefresh"
      >
        <template #icon>
          <refresh-icon />
        </template>
      </t-button>
    </div>
    <div class="xhs-files__body">
      <div v-for="section in sections" :key="section.kind" class="xhs-files__section">
        <div class="xhs-files__title">
          <component :is="section.icon" class="xhs-files__icon" />
          <span>{{ section.title }}</span>
          <span class="xhs-files__count">{{ section.items.length }}</span>
        </div>
        <div v-if="section.items.length" class="xhs-files__list">
          <div
            v-for="item in section.items"
            :key="item.path"
            class="xhs-file"
            :title="item.path"
            @click="handleReveal(item)"
          >
            <div class="xhs-file__main">
              <div class="xhs-file__label">{{ item.label }}</div>
              <div class="xhs-file__meta">{{ item.meta }}</div>
            </div>
            <t-tag size="small" variant="light">{{ item.tag }}</t-tag>
          </div>
        </div>
        <div v-else class="xhs-files__empty">{{ section.emptyHint }}</div>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { RefreshIcon } from 'tdesign-icons-vue-next'
import type { ChatMessage } from '@/domain'
import { useXhsFiles } from './useXhsFiles'
import type { XhsFileItem } from './useXhsFiles'

/**
 * 小红书「文件」tab：三类产物（导出图片 / 生图素材 / 正文文件）分组列表，
 * 点击条目在系统文件管理器中定位（取用发布最省事）。数据层见 useXhsFiles。
 */
const props = withDefaults(
  defineProps<{
    sandbox?: string
    workspace?: string
    /** 本聊天消息流：图片两类产物从工具调用记录取真实落点（含显式路径） */
    messages?: ChatMessage[]
    /** 本 tab 是否当前可见：切到本页时重扫产物 */
    active?: boolean
  }>(),
  {
    sandbox: '',
    workspace: '',
    messages: () => [],
    active: false
  }
)

const { loading, sections, refresh } = useXhsFiles(() => ({
  sandbox: props.sandbox,
  workspace: props.workspace,
  messages: props.messages,
  active: props.active
}))

const handleRefresh = (): void => void refresh()

/** 点击条目：在系统文件管理器中定位该文件 */
const handleReveal = (item: XhsFileItem): void => {
  window.preload.inject.shell.showItemInFolder(item.path)
}
</script>
<style scoped lang="less">
.xhs-files {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-left: 6px;

  &__bar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__hint {
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }

  &__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-right: 4px;
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 6px;
    font: var(--td-font-body-small);
    font-weight: 600;
    color: var(--td-text-color-secondary);
  }

  &__icon {
    font-size: 14px;
  }

  &__count {
    font-weight: 400;
    color: var(--td-text-color-placeholder);
    font-variant-numeric: tabular-nums;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__empty {
    padding: 2px 8px;
    font: var(--td-font-body-small);
    line-height: 1.7;
    color: var(--td-text-color-placeholder);
  }
}

.xhs-file {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--td-radius-medium);
  cursor: pointer;

  &:hover {
    background: var(--td-bg-color-secondarycontainer);
  }

  &__main {
    flex: 1;
    min-width: 0;
  }

  &__label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font: var(--td-font-body-small);
    color: var(--td-text-color-primary);
  }

  &__meta {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
    font-variant-numeric: tabular-nums;
  }
}
</style>
