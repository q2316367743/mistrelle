<template>
  <div class="ppt-layer" :data-node-id="node.id" :style="style">
    <ppt-node v-for="(child, i) in children" :key="child.id ?? i" :node="child" :theme="theme" />
  </div>
</template>
<script lang="ts" setup>
/**
 * Layer 绝对定位容器：relative 盒 + 子元素按 attr.position="absolute" + top/left 定位
 * （定位样式由 commonStyle 解析；未声明 absolute 的子元素按普通流排布）。
 */
import { computed, type CSSProperties } from 'vue'
import type { PptTheme, SlideNode } from '../pptTypes'
import { commonStyle } from './attrStyle'
import PptNode from './PptNode.vue'

const props = defineProps<{ node: SlideNode; theme: PptTheme }>()

const children = computed<SlideNode[]>(() =>
  Array.isArray(props.node.child) ? props.node.child : []
)

const style = computed<CSSProperties>(() => ({
  ...commonStyle(props.node, props.theme),
  position: props.node.attr.position === 'absolute' ? 'absolute' : 'relative'
}))
</script>
