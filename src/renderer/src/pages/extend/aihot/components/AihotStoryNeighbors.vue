<template>
  <div class="aihot-neighbors">
    <div class="aihot-neighbors__label">事件脉络</div>
    <div class="aihot-neighbors__list">
      <div
        v-for="n in neighbors"
        :key="`neighbor-${n.publicId}`"
        class="aihot-neighbors__item"
        :title="n.title"
        @click="emit('jump', n)"
      >
        <span class="aihot-neighbors__title">{{ n.title }}</span>
        <span class="aihot-neighbors__relation">{{ n.relation }}</span>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import type { AihotStoryNeighbor } from '@/modules/api/aihot'

defineProps<{
  neighbors: Array<AihotStoryNeighbor>
}>()
const emit = defineEmits<{
  jump: [neighbor: AihotStoryNeighbor]
}>()
</script>
<style scoped lang="less">
.aihot-neighbors {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__label {
    font: var(--td-font-title-small);
    font-weight: 700;
    color: var(--td-text-color-primary);
    padding-left: 8px;
    border-left: 3px solid var(--td-brand-color);
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border: 1px solid var(--td-component-stroke);
    border-radius: var(--td-radius-medium);
    background-color: var(--td-bg-color-container);
    cursor: pointer;
    transition: background-color var(--fluent-transition-fast);

    &:hover {
      background-color: var(--td-bg-color-container-hover);
    }
  }

  &__title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font: var(--td-font-body-medium);
    color: var(--td-text-color-primary);
  }

  &__relation {
    flex-shrink: 0;
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }
}
</style>
