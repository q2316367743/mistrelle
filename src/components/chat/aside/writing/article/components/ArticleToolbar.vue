<template>
  <div class="article-toolbar">
    <div class="article-toolbar__title">
      <t-tag theme="primary" variant="light" size="small">{{ rootLabel }}</t-tag>
      <span class="article-toolbar__name">{{ projectTitle || '文章创作' }}</span>
    </div>
    <div class="article-toolbar__actions">
      <t-button theme="primary" variant="text" shape="square" title="新建文章" @click="$emit('create')">
        <template #icon>
          <file-add-icon />
        </template>
      </t-button>
      <t-button theme="primary" variant="text" shape="square" title="刷新" @click="$emit('refresh')">
        <template #icon>
          <refresh-icon />
        </template>
      </t-button>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { FileAddIcon, RefreshIcon } from 'tdesign-icons-vue-next'

withDefaults(
  defineProps<{
    projectTitle?: string
    rootLabel?: string
  }>(),
  {
    projectTitle: '',
    rootLabel: ''
  }
)

defineEmits<{
  (e: 'create'): void
  (e: 'refresh'): void
}>()
</script>
<style scoped lang="less">
.article-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;

  &__title {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--td-font-size-body-medium);
    color: var(--td-text-color-primary);
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 2px;
  }
}
</style>
