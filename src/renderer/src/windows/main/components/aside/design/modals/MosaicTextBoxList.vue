<template>
  <div class="mosaic-text-list">
    <div class="mosaic-text-list__header">
      <span>识别到的文字（{{ texts.length }}）</span>
      <t-button size="small" theme="primary" variant="text" :loading="busy" @click="emit('recognize')">
        重新识别
      </t-button>
    </div>
    <div class="mosaic-text-list__body">
      <div
        v-for="(text, index) in texts"
        :key="index"
        class="mosaic-text-list__item"
        :class="{ 'mosaic-text-list__item--active': marked.has(index) }"
        @mouseenter="emit('hover', index)"
        @mouseleave="emit('hover', -1)"
      >
        <t-checkbox :checked="marked.has(index)" @change="emit('toggle', index)" />
        <span class="mosaic-text-list__text ellipsis" @click="emit('toggle', index)">{{ text }}</span>
      </div>
      <div v-if="!texts.length" class="mosaic-text-list__empty">
        {{
          busy
            ? '正在识别文字…'
            : failed
              ? '文字识别失败，可重试或改用手动涂抹'
              : '未识别到文字，可改用手动涂抹'
        }}
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
defineProps<{
  /** OCR 识别到的文本（与文字框同序） */
  texts: string[]
  /** 已标记的文字框下标集合 */
  marked: Set<number>
  /** 图上悬停的文字框（与列表悬停互相呼应） */
  hovered: number
  busy: boolean
  failed: boolean
}>()

const emit = defineEmits<{
  /** 勾选 / 取消某个文字框 */
  (e: 'toggle', index: number): void
  /** 悬停联动（-1 表示离开） */
  (e: 'hover', index: number): void
  (e: 'recognize'): void
}>()
</script>
<style scoped lang="less">
.mosaic-text-list {
  width: 240px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: var(--td-radius-medium);
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    padding: 4px 4px 4px 12px;
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-secondary);
    border-bottom: 1px solid var(--td-border-level-1-color);
  }

  &__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 4px;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 4px;
    border-radius: var(--td-radius-small);

    &:hover,
    &--active {
      background-color: var(--td-bg-color-container-hover);
    }
  }

  &__text {
    flex: 1;
    min-width: 0;
    font-size: var(--td-font-size-body-small);
    cursor: pointer;
  }

  &__empty {
    padding: 12px 8px;
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-placeholder);
  }
}
</style>
