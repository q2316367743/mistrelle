<template>
  <t-card size="small" hover-shadow class="project-card" @click="emit('open')">
    <div class="project-card__inner">
      <div class="project-card__icon">
        <link-icon />
      </div>
      <div class="project-card__main">
        <div class="project-card__name" :title="project.name">{{ project.name }}</div>
        <div class="project-card__meta">添加于 {{ relativeTime }}</div>
      </div>
      <t-dropdown :popup-props="{ trigger: 'click' }" @click.stop>
        <t-button
          theme="primary"
          variant="text"
          shape="square"
          size="small"
          @click.stop
        >
          <template #icon><MoreIcon /></template>
        </t-button>
        <t-dropdown-menu>
          <t-dropdown-item @click="emit('rename')">
            <template #prefix-icon><EditIcon /></template>
            重命名
          </t-dropdown-item>
          <t-dropdown-item @click="emit('edit')">
            <template #prefix-icon><SettingIcon /></template>
            编辑
          </t-dropdown-item>
          <t-dropdown-item @click="emit('delete')">
            <template #prefix-icon><DeleteIcon class="color-red" /></template>
            <span class="color-red">删除</span>
          </t-dropdown-item>
        </t-dropdown-menu>
      </t-dropdown>
    </div>
  </t-card>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { LinkIcon, MoreIcon, EditIcon, DeleteIcon, SettingIcon } from 'tdesign-icons-vue-next'
import { Project } from '@/entity'
import { formatRelativeTime } from '../func'

const props = defineProps<{ project: Project }>()
const emit = defineEmits<{ open: []; rename: []; edit: []; delete: [] }>()

const relativeTime = computed(() => formatRelativeTime(props.project.createdAt))
</script>

<style scoped lang="less">
.project-card {
  cursor: pointer;

  &__inner {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    background: var(--td-bg-color-component);
    border-radius: var(--td-radius-medium);
    color: var(--td-text-color-secondary);
  }

  &__main {
    flex: 1;
    min-width: 0;
  }

  &__name {
    overflow: hidden;
    font: var(--td-font-title-small);
    color: var(--td-text-color-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta {
    margin-top: 4px;
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }
}
</style>
