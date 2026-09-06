<template>
  <div
    class="user-row"
    :class="{ 'is-clickable': clickable, 'is-danger': danger }"
    :role="clickable ? 'button' : undefined"
    :tabindex="clickable ? 0 : undefined"
    @click="onClick"
    @keydown.enter.prevent="onActivate"
    @keydown.space.prevent="onActivate"
  >
    <component :is="icon" class="user-row__icon" />
    <div class="user-row__meta">
      <span class="user-row__label">{{ label }}</span>
      <span v-if="description" class="user-row__desc">{{ description }}</span>
    </div>
    <div class="user-row__action">
      <slot />
      <chevron-right-icon v-if="arrow" class="user-row__arrow" />
    </div>
  </div>
</template>
<script lang="ts" setup>
import type { Component } from 'vue'
import { ChevronRightIcon } from 'tdesign-icons-vue-next'

const props = defineProps<{
  icon: Component
  label: string
  description?: string
  arrow?: boolean
  clickable?: boolean
  danger?: boolean
}>()

const emit = defineEmits<{
  click: [e: MouseEvent | KeyboardEvent]
}>()

function onClick(e: MouseEvent): void {
  if (props.clickable) emit('click', e)
}

function onActivate(e: KeyboardEvent): void {
  if (props.clickable) emit('click', e)
}
</script>
<style scoped lang="less">
.user-row {
  display: flex;
  align-items: center;
  gap: var(--td-comp-margin-s);
  min-height: var(--td-comp-size-m);
  padding: 0 var(--td-comp-paddingLR-m);
  border-radius: var(--td-radius-small);
  color: var(--td-text-color-primary);
  font: var(--td-font-body-medium);
  transition: background var(--fluent-transition-fast);

  &.is-clickable {
    cursor: pointer;

    &:hover {
      background: var(--fluent-item-hover);
    }

    &:focus-visible {
      outline: none;
      box-shadow: var(--fluent-focus-ring);
    }
  }

  &.is-danger {
    color: var(--td-error-color);

    .user-row__icon,
    .user-row__arrow {
      color: var(--td-error-color);
    }
  }

  &__icon {
    flex-shrink: 0;
    font-size: 16px;
    color: var(--td-text-color-secondary);
  }

  &__meta {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  &__label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__desc {
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
  }

  &__action {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: var(--td-comp-margin-xs);
    margin-left: auto;
    color: var(--td-text-color-secondary);
    font: var(--td-font-body-small);
  }

  &__arrow {
    font-size: 16px;
    color: var(--td-text-color-placeholder);
  }
}
</style>
