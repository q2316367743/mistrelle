<template>
  <div
    class="account-row"
    :class="{
      'is-clickable': clickable,
      'is-danger': danger,
      'has-body': Boolean($slots.default)
    }"
    :role="clickable ? 'button' : undefined"
    :tabindex="clickable ? 0 : undefined"
    @click="onClick"
    @keydown.enter.prevent="onActivate"
    @keydown.space.prevent="onActivate"
  >
    <t-icon :name="icon" class="account-row__icon" />
    <div class="account-row__meta">
      <div class="account-row__title">{{ title }}</div>
      <div v-if="description" class="account-row__desc">{{ description }}</div>
    </div>
    <div class="account-row__action">
      <slot name="action" />
      <t-icon v-if="arrow" name="chevron-right" class="account-row__arrow" />
    </div>
    <div v-if="$slots.default" class="account-row__body">
      <slot />
    </div>
  </div>
</template>
<script lang="ts" setup>
const props = defineProps<{
  icon: string
  title: string
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
.account-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-areas: 'icon meta action';
  column-gap: 12px;
  row-gap: 10px;
  align-items: center;
  padding: 14px 12px;
  border-radius: var(--fluent-radius-smooth);
  transition: background-color var(--fluent-transition-fast);

  &.has-body {
    grid-template-areas:
      'icon meta action'
      '. body body';
  }

  & + & {
    border-top: 1px solid var(--td-component-stroke);
  }

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

  &.is-danger .account-row__icon {
    color: var(--td-error-color);
  }

  &__icon {
    grid-area: icon;
    font-size: 20px;
    color: var(--td-brand-color);
  }

  &__meta {
    grid-area: meta;
    min-width: 0;
  }

  &__title {
    font: var(--td-font-body-large);
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  &__desc {
    margin-top: 2px;
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
  }

  &__action {
    grid-area: action;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__arrow {
    font-size: 16px;
    color: var(--td-text-color-placeholder);
  }

  &__body {
    grid-area: body;
  }
}
</style>
