<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    :class="className"
    aria-hidden="true"
  >
    <template v-for="(item, i) in node" :key="i">
      <path v-if="item[0] === 'path'" v-bind="item[1]" />
      <circle v-else-if="item[0] === 'circle'" v-bind="item[1]" />
      <rect v-else-if="item[0] === 'rect'" v-bind="item[1]" />
    </template>
  </svg>
</template>

<script lang="ts" setup>
import type { IconNode } from './icons'

/** 参考站图标渲染器（lucide 线框风格，1:1 对应其构建产物） */
withDefaults(
  defineProps<{
    node: Array<IconNode>
    size?: number
    strokeWidth?: number
    className?: string
  }>(),
  { size: 24, strokeWidth: 2, className: '' }
)
</script>
