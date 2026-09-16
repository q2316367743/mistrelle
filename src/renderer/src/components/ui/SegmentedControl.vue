<template>
  <div ref="containerRef" class="segmented" role="radiogroup" @keydown="handleKeydown">
    <div class="segmented__indicator" :style="indicatorStyle" />
    <button
      v-for="option in options"
      :key="option.value"
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
<script lang="ts" setup>
import type { Component } from 'vue'

interface SegmentedOption<T> {
  value: T
  label: string
  icon?: Component
}

const props = defineProps<{
  options: readonly SegmentedOption<any>[]
}>()

const modelValue = defineModel<any>()

const containerRef = ref<HTMLElement>()

/** 选中滑块几何状态：来源为容器内真实 DOM，而非 v-for 的数组模板引用 */
const indicatorStyle = ref({ transform: 'translateX(0px)', width: '0px' })

const selectedIndex = computed(() =>
  props.options.findIndex((option) => option.value === modelValue.value)
)

/**
 * 取第 index 个选项按钮。刻意查询真实 DOM：v-for 的数组模板引用在 options
 * 整体替换（写作 ↔ 设计切换）后与存活节点失同步，会量到 null / 已卸载节点，
 * 使滑块塌缩为 0 宽、选中态丢失。
 */
const getItem = (index: number): HTMLElement | undefined =>
  containerRef.value?.querySelectorAll<HTMLElement>('.segmented__item')[index]

/** 量取当前选中项，重算滑块位移与宽度（必须在 DOM patch 之后调用） */
const measure = () => {
  const item = getItem(selectedIndex.value)
  indicatorStyle.value = item
    ? { transform: `translateX(${item.offsetLeft}px)`, width: `${item.offsetWidth}px` }
    : { transform: 'translateX(0px)', width: '0px' }
}

// flush: 'post' 确保 options 变化触发的 v-for 重建完成后再量取
watch([selectedIndex, () => props.options], measure, { immediate: true, flush: 'post' })

// 容器尺寸变化（字体加载 / 标签增减）后重测
let observer: ResizeObserver | undefined
onMounted(() => {
  measure()
  observer = new ResizeObserver(measure)
  if (containerRef.value) observer.observe(containerRef.value)
})
onBeforeUnmount(() => observer?.disconnect())

const handleSelect = (value: any) => {
  modelValue.value = value
}

const handleKeydown = (event: KeyboardEvent) => {
  const count = props.options.length
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  event.preventDefault()
  const direction = event.key === 'ArrowRight' ? 1 : -1
  const next = (selectedIndex.value + direction + count) % count
  handleSelect(props.options[next].value)
  getItem(next)?.focus()
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
  transition:
    transform var(--fluent-transition-normal),
    width var(--fluent-transition-normal);
}

.segmented__item {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: none;
  height: 32px;
  border-radius: 5px;
  background: transparent;
  color: var(--td-text-color-secondary);
  font-size: var(--td-font-size-body-medium);
  cursor: pointer;
  outline: none;
  transition:
    color var(--fluent-transition-fast),
    background-color var(--fluent-transition-fast);

  &:hover {
    background: var(--fluent-reveal-bg);
  }

  &--active {
    color: var(--td-text-color-primary);
    font-weight: 600;
    &:hover {
      background-color: transparent;
    }
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
