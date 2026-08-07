<template>
  <div class="canvas-element-tree">
    <div class="canvas-element-tree__header">元素</div>
    <div class="canvas-element-tree__body">
      <div
        v-for="node in visibleNodes"
        :key="node.id"
        class="canvas-element-tree__node"
        :class="{ 'is-active': node.id === selectedId }"
        :style="{ paddingLeft: `${6 + node.depth * 16}px` }"
        @click="handleNodeClick(node.id)"
      >
        <span
          class="canvas-element-tree__caret"
          :class="{ 'is-expanded': node.expanded }"
          @click.stop="node.hasChildren && handleToggle(node.id)"
        >
          <caret-right-small-icon v-if="node.hasChildren" />
        </span>
        <component :is="node.icon" class="canvas-element-tree__icon" />
        <span class="canvas-element-tree__label ellipsis">{{ node.label }}</span>
      </div>
      <div v-if="!visibleNodes.length" class="canvas-element-tree__empty">暂无元素</div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import type { Component } from 'vue'
import { CaretRightSmallIcon, ImageIcon, LayersIcon, RectangleIcon, TextIcon } from 'tdesign-icons-vue-next'
import type { CanvasNode } from '@/modules/canvas'

interface FlatNode {
  id: string
  label: string
  depth: number
  hasChildren: boolean
  expanded: boolean
  icon: Component
}

const props = defineProps<{
  nodes: CanvasNode[]
  selectedId?: string
}>()

const emit = defineEmits<{
  (e: 'select', id: string | undefined): void
}>()

const typeIconMap: Record<string, Component> = {
  group: LayersIcon,
  text: TextIcon,
  rect: RectangleIcon,
  image: ImageIcon,
  svg: ImageIcon
}

/** 收集全部 group 节点 id（默认展开所有分组） */
const collectGroupIds = (nodes: CanvasNode[], into: Set<string>) => {
  for (const node of nodes) {
    if (node.children?.length) {
      into.add(node.id)
      collectGroupIds(node.children, into)
    }
  }
}

const expandedIds = ref<Set<string>>(new Set())

// 新增的 group 默认展开，用户手动折叠的不再展开
watch(
  () => props.nodes,
  (nodes) => {
    const ids = new Set<string>()
    collectGroupIds(nodes, ids)
    for (const id of ids) expandedIds.value.add(id)
  },
  { deep: true, immediate: true }
)

const handleToggle = (id: string) => {
  const next = new Set(expandedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedIds.value = next
}

const handleNodeClick = (id: string) => {
  emit('select', id)
}

const visibleNodes = computed<FlatNode[]>(() => {
  const result: FlatNode[] = []
  const walk = (nodes: CanvasNode[], depth: number) => {
    for (const node of nodes) {
      const hasChildren = !!node.children?.length
      result.push({
        id: node.id,
        label: node.name || node.type,
        depth,
        hasChildren,
        expanded: hasChildren && expandedIds.value.has(node.id),
        icon: typeIconMap[node.type] ?? RectangleIcon
      })
      if (hasChildren && expandedIds.value.has(node.id)) walk(node.children ?? [], depth + 1)
    }
  }
  walk(props.nodes, 0)
  return result
})
</script>
<style scoped lang="less">
.canvas-element-tree {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding-right: 8px;
  border-right: 1px solid var(--td-border-level-1-color);

  &__header {
    padding: 4px 0;
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-placeholder);
  }

  &__body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    margin-bottom:  16px;
  }

  &__node {
    display: flex;
    align-items: center;
    height: 28px;
    padding-right: 8px;
    border-radius: var(--td-radius-small);
    cursor: pointer;
    color: var(--td-text-color-secondary);
    transition: background-color 0.2s ease-in-out;

    &:hover {
      background-color: var(--td-bg-color-container-hover);
    }

    &.is-active {
      background-color: var(--td-brand-color-light);
      color: var(--td-brand-color);

      .canvas-element-tree__icon {
        color: var(--td-brand-color);
      }
    }
  }

  &__caret {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 100%;
    color: var(--td-text-color-placeholder);

    svg {
      width: 14px;
      height: 14px;
      transition: transform 0.2s ease-in-out;
    }

    &.is-expanded svg {
      transform: rotate(90deg);
    }
  }

  &__icon {
    width: 14px;
    height: 14px;
    margin-right: 6px;
    flex-shrink: 0;
    color: var(--td-text-color-placeholder);
  }

  &__label {
    flex: 1;
    min-width: 0;
    font-size: var(--td-font-size-body-small);
  }

  &__empty {
    padding: 8px 0;
    text-align: center;
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-placeholder);
  }
}
</style>
