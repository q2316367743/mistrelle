<template>
  <div class="novel-header">
    <novel-cover-thumb
      v-if="novel"
      :cover="novel.cover"
      :assets-dir="assetsDir"
      :context="coverContext"
      @cover="$emit('cover', $event)"
    />
    <t-select
      class="novel-header__select"
      :value="activeId"
      placeholder="选择小说"
      :empty="'暂无小说，可让 AI 生成'"
      :popup-props="{ overlayClassName: 'novel-select-overlay' }"
      @change="$emit('select', $event)"
    >
      <t-option v-for="n in novels" :key="n.id" :value="n.id" :label="n.title">
        <div class="novel-header__option">
          <span class="novel-header__option-title">{{ n.title }}</span>
          <div class="novel-header__option-meta">
            <t-tag size="small" variant="light">{{ n.genre }}</t-tag>
            <span v-if="n.words" class="novel-header__option-words">{{ n.words }} 字</span>
          </div>
        </div>
      </t-option>
    </t-select>
    <t-button theme="primary" variant="text" shape="square" title="在文件夹中显示" @click="$emit('reveal')">
      <template #icon><folder-open-icon /></template>
    </t-button>
    <t-button theme="primary" variant="text" shape="square" title="刷新" @click="$emit('refresh')">
      <template #icon><refresh-icon /></template>
    </t-button>
  </div>
</template>
<script lang="ts" setup>
import { FolderOpenIcon, RefreshIcon } from 'tdesign-icons-vue-next'
import type { NovelItem } from '@/windows/main/modules/tool/components/novel/novelTypes'
import NovelCoverThumb from './NovelCoverThumb.vue'

const props = defineProps<{
  /** 当前选中小说；无小说或未选中时为空（头部仍渲染，仅隐藏封面位） */
  novel?: NovelItem
  /** 项目内全部小说（下拉切换） */
  novels: NovelItem[]
  activeId: string
  /** 封面目录（{root}/{id}/assets 绝对路径） */
  assetsDir: string
}>()

defineEmits<{
  (e: 'select', id: unknown): void
  (e: 'cover', rel: string | undefined): void
  (e: 'reveal'): void
  (e: 'refresh'): void
}>()

/** 封面生图起草语境：标题 + 题材 + 摘要 */
const coverContext = computed(() =>
  props.novel
    ? {
        title: props.novel.title,
        summary: [props.novel.genre, props.novel.summary].filter(Boolean).join(' · ')
      }
    : undefined
)
</script>
<style scoped lang="less">
.novel-header {
  display: flex;
  align-items: center;
  gap: 4px;

  &__select {
    flex: 1;
    min-width: 0;
  }

  &__option {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__option-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__option-meta {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__option-words {
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-placeholder);
    font-variant-numeric: tabular-nums;
  }
}
</style>
<style lang="less">
/* 自定义 select 下拉选项面板（teleport 到 body，需全局样式；类名见 popup-props.overlayClassName） */
.novel-select-overlay {
  .t-select-option {
    height: 100%;
    padding: 8px;
  }
}
</style>
