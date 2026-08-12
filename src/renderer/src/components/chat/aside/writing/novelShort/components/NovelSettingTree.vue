<template>
  <div class="novel-tree">
    <div class="novel-tree__title">{{ title }}</div>
    <div
      class="novel-tree__file"
      :class="{ 'is-active': activeFile === 'story' }"
      @click="select('story')"
    >
      <edit-icon class="novel-tree__icon" />
      <span>正文</span>
    </div>
    <div class="novel-tree__group">
      <div
        class="novel-tree__file"
        :class="{ 'is-active': activeFile === 'characters' }"
        @click="select('characters')"
      >
        <user-circle-icon class="novel-tree__icon" />
        <span>角色</span>
      </div>
      <div
        v-for="name in characterNames"
        :key="name"
        class="novel-tree__child"
        :class="{ 'is-active': activeFile === 'characters' }"
        @click="select('characters')"
      >
        {{ name }}
      </div>
    </div>
    <div
      class="novel-tree__file"
      :class="{ 'is-active': activeFile === 'outline' }"
      @click="select('outline')"
    >
      <list-numbered-icon class="novel-tree__icon" />
      <span>大纲</span>
    </div>
    <div
      class="novel-tree__file"
      :class="{ 'is-active': activeFile === 'setting' }"
      @click="select('setting')"
    >
      <setting-icon class="novel-tree__icon" />
      <span>设定</span>
    </div>
    <div
      class="novel-tree__file"
      :class="{ 'is-active': activeFile === 'style' }"
      @click="select('style')"
    >
      <palette-icon class="novel-tree__icon" />
      <span>文风</span>
    </div>
  </div>
</template>
<script lang="ts" setup>
import {
  EditIcon,
  ListNumberedIcon,
  PaletteIcon,
  SettingIcon,
  UserCircleIcon
} from 'tdesign-icons-vue-next'
import type { NovelFileKey } from '@/modules/tool/components/novel/novelTypes'

const props = defineProps<{
  title: string
  activeFile: NovelFileKey
  /** characters.md 原始内容（用于解析角色卡列表） */
  characters: string
}>()

const emit = defineEmits<{
  (e: 'select', key: NovelFileKey): void
}>()

/** 从 characters.md 解析「## 角色名」标题列表 */
const characterNames = computed(() =>
  [...(props.characters ?? '').matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => m[1])
)

const select = (key: NovelFileKey) => {
  emit('select', key)
}
</script>
<style scoped lang="less">
.novel-tree {
  width: 200px;
  min-width: 200px;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px;
  box-sizing: border-box;
  border-radius: var(--td-radius-medium);
  border: 1px solid var(--td-border-level-1-color);
  background: var(--td-bg-color-container);

  &__title {
    font-size: var(--td-font-size-body-medium);
    font-weight: 600;
    color: var(--td-text-color-primary);
    margin-bottom: 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__file,
  &__child {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border-radius: var(--td-radius-default);
    cursor: pointer;
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &:hover {
      background: var(--td-bg-color-container-hover);
    }

    &.is-active {
      background: var(--td-brand-color-light);
      color: var(--td-brand-color);
    }
  }

  &__child {
    padding-left: 28px;
  }

  &__icon {
    font-size: 15px;
    flex-shrink: 0;
  }
}
</style>
