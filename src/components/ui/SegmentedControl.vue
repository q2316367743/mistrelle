<template>
  <div ref="containerRef" class="segmented" role="radiogroup" @keydown="handleKeydown">
    <div class="segmented__indicator" :style="indicatorStyle" />
    <button
      v-for="(option, index) in options"
      :id="`segmented-item-${index}`"
      :key="option.value"
      ref="itemRefs"
      type="button"
      role="radio"
      :aria-checked="modelValue === option.value"
      class="segmented__item"
      :class="{ 'segmented__item--active': modelValue === option.value }"
      @click="handleSelect(option.value)"
    >
      <component :is="option.icon" size="18px" class="segmented__icon" />
      <span>{{ option.label }}</span>
    </button>
  </div>
</template>
<script lang="ts" setup generic="T extends string">
import type { Component } from 'vue'

interface SegmentedOption<T> {
  value: T
  label: string
  icon?: Component
}

const props = defineProps<{
  options: readonly SegmentedOption<T>[]
}>()

const modelValue = defineModel<T>()

const containerRef = ref<HTMLElement>()
const itemRefs = ref<HTMLElement[]>([])

const selectedIndex = computed(() =>
  props.options.findIndex((option) => option.value === modelValue.value)
)

const indicatorStyle = computed(() => {
  const index = selectedIndex.value
  const item = itemRefs.value[index]
  if (!item) return { transform: 'translateX(0px)', width: '0px' }
  return {
    transform: `translateX(${item.offsetLeft}px)`,
    width: `${item.offsetWidth}px`
  }
})

const handleSelect = (value: T) => {
  modelValue.value = value
}

const handleKeydown = (event: KeyboardEvent) => {
  const count = props.options.length
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  event.preventDefault()
  const direction = event.key === 'ArrowRight' ? 1 : -1
  const next = (selectedIndex.value + direction + count) % count
  handleSelect(props.options[next].value)
  ;(itemRefs.value[next] as HTMLElement | undefined)?.focus()
}
</script>
<style scoped lang="less">
.segmented {
  position: relative;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  width: fit-content;
  border-radius: var(--fluent-radius-smooth);
  background: var(--fluent-item-hover);
}

.segmented__indicator {
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 0;
  border-radius: 5px;
  background: var(--fluent-card-bg);
  box-shadow: var(--fluent-elevation-2);
  transition: transform var(--fluent-transition-normal), width var(--fluent-transition-normal);
}

.segmented__item {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--td-text-color-secondary);
  font-size: var(--td-font-size-body-medium);
  cursor: pointer;
  outline: none;
  transition: color var(--fluent-transition-fast), background-color var(--fluent-transition-fast);

  &:hover {
    background: var(--fluent-reveal-bg);
  }

  &:focus-visible {
    box-shadow: var(--fluent-focus-ring);
  }

  &--active {
    color: var(--td-text-color-primary);
    font-weight: 600;
  }
}

.segmented__icon {
  color: var(--td-text-color-placeholder);
  transition: color var(--fluent-transition-fast);

  .segmented__item--active & {
    color: var(--fluent-accent-color);
  }
}
</style>
