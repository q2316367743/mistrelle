<template>
  <div class="html-element-tree">
    <div class="html-element-tree__header">元素</div>
    <div class="html-element-tree__body">
      <div
        v-for="node in visibleNodes"
        :key="node.id"
        class="html-element-tree__node"
        :class="{ 'is-active': node.id === selectedPath }"
        :style="{ paddingLeft: `${6 + node.depth * 16}px` }"
        :title="node.chain"
        @click="handleNodeClick(node.id)"
      >
        <span
          class="html-element-tree__caret"
          :class="{ 'is-expanded': node.expanded }"
          @click.stop="node.hasChildren && handleToggle(node.id)"
        >
          <caret-right-small-icon v-if="node.hasChildren" />
        </span>
        <component :is="node.icon" class="html-element-tree__icon" />
        <span class="html-element-tree__label ellipsis">{{ node.label }}</span>
      </div>
      <div v-if="!visibleNodes.length" class="html-element-tree__empty">暂无元素</div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import type { Component } from 'vue'
import {
  CaretRightSmallIcon,
  ImageIcon,
  RectangleIcon,
  TextIcon
} from 'tdesign-icons-vue-next'
import type { HtmlTreeNode } from '@/components/chat/design/htmlElementBridge'

interface FlatNode {
  id: string
  label: string
  chain: string
  depth: number
  hasChildren: boolean
  expanded: boolean
  icon: Component
}

const props = defineProps<{
  nodes: HtmlTreeNode[]
  selectedPath?: string
}>()

const emit = defineEmits<{
  (e: 'select', path: string | undefined): void
}>()

/** 文本类标签 → 文字图标，图片类 → 图片图标，其余容器/图形 → 矩形图标 */
const tagIcon = (label: string): Component => {
  const tag = label.split(/[.#]/)[0]
  if (tag === 'img' || tag === 'svg' || tag === 'picture' || tag === 'canvas') return ImageIcon
  const textTags = [
    'span',
    'a',
    'p',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'em',
    'strong',
    'b',
    'i',
    'label',
    'small',
    'code',
    'button'
  ]
  return textTags.includes(tag) ? TextIcon : RectangleIcon
}

/** 选中元素的祖先链 id（自动展开定位用） */
const collectAncestorIds = (path: string | undefined): string[] => {
  if (!path) return []
  const segs = path.split(';')
  return segs.map((_, i) => segs.slice(0, i + 1).join(';'))
}

const expandedIds = ref<Set<string>>(new Set())

// 树重建后默认展开前两级 + 选中路径的祖先链（滚轮扩大 / 双击深层元素时树跟随展开）
watch(
  () => props.nodes,
  (nodes) => {
    const next = new Set<string>()
    const walk = (list: HtmlTreeNode[], depth: number) => {
      for (const node of list) {
        if (node.children.length && depth <= 1) next.add(node.id)
        if (node.children.length) walk(node.children, depth + 1)
      }
    }
    walk(nodes, 0)
    for (const id of collectAncestorIds(props.selectedPath)) next.add(id)
    expandedIds.value = next
  },
  { deep: true, immediate: true }
)

watch(
  () => props.selectedPath,
  (path) => {
    if (!path) return
    const next = new Set(expandedIds.value)
    for (const id of collectAncestorIds(path)) next.add(id)
    expandedIds.value = next
  }
)

const handleToggle = (id: string) => {
  const next = new Set(expandedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedIds.value = next
}

/** 点击已选中节点 = 取消选中（与预览空白点击语义一致） */
const handleNodeClick = (id: string) => {
  emit('select', id === props.selectedPath ? undefined : id)
}

const visibleNodes = computed<FlatNode[]>(() => {
  const result: FlatNode[] = []
  const walk = (nodes: HtmlTreeNode[], depth: number) => {
    for (const node of nodes) {
      const hasChildren = node.children.length > 0
      result.push({
        id: node.id,
        label: node.label,
        chain: node.chain,
        depth,
        hasChildren,
        expanded: hasChildren && expandedIds.value.has(node.id),
        icon: tagIcon(node.label)
      })
      if (hasChildren && expandedIds.value.has(node.id)) walk(node.children, depth + 1)
    }
  }
  walk(props.nodes, 0)
  return result
})
</script>
<style scoped lang="less">
.html-element-tree {
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
    margin-bottom: 16px;
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

      .html-element-tree__icon {
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
