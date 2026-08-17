<template>
  <component :is="comp" v-if="comp" ref="compRef" :node="node" :theme="theme" />
</template>
<script lang="ts" setup>
/**
 * SlideNode 分发器：按 tag 映射渲染组件；未知 tag 静默忽略（校验层已拦截）。
 * 所有子组件根元素挂 data-node-id（含复合节点子项），供点选与快照几何测量。
 * backgroundImage.src 为本地路径时异步解析后挂到根元素（同步 style 无法引用本地文件）。
 */
import { computed, onMounted, ref, watch, type Component, type ComponentPublicInstance } from 'vue'
import type { PptTheme, SlideNode } from '../pptTypes'
import PptStack from './PptStack.vue'
import PptText from './PptText.vue'
import PptShape from './PptShape.vue'
import PptImage from './PptImage.vue'
import PptIcon from './PptIcon.vue'
import PptSvg from './PptSvg.vue'
import PptList from './PptList.vue'
import PptLayer from './PptLayer.vue'
import PptTable from './PptTable.vue'
import PptChart from './PptChart.vue'
import PptTimeline from './PptTimeline.vue'
import PptFlow from './PptFlow.vue'
import PptTree from './PptTree.vue'
import PptMatrix from './PptMatrix.vue'
import PptPyramid from './PptPyramid.vue'
import PptProcessArrow from './PptProcessArrow.vue'
import { resolveSrc } from './resolveSrc'

const props = defineProps<{ node: SlideNode; theme: PptTheme }>()

const COMPONENTS: Record<string, Component> = {
  VStack: PptStack,
  HStack: PptStack,
  Text: PptText,
  Shape: PptShape,
  Image: PptImage,
  Icon: PptIcon,
  Svg: PptSvg,
  Ul: PptList,
  Ol: PptList,
  Layer: PptLayer,
  Table: PptTable,
  Chart: PptChart,
  Timeline: PptTimeline,
  Flow: PptFlow,
  Tree: PptTree,
  Matrix: PptMatrix,
  Pyramid: PptPyramid,
  ProcessArrow: PptProcessArrow
}

const comp = computed<Component | null>(() => COMPONENTS[props.node.tag] ?? null)

const compRef = ref<ComponentPublicInstance | null>(null)

const applyBackgroundImage = async (): Promise<void> => {
  const src = props.node.attr['backgroundImage.src']
  const el = compRef.value?.$el
  if (!src || !(el instanceof HTMLElement)) return
  const url = await resolveSrc(src)
  if (!url || el !== compRef.value?.$el) return
  el.style.backgroundImage = `url("${url}")`
  el.style.backgroundSize =
    props.node.attr['backgroundImage.sizing'] === 'contain' ? 'contain' : 'cover'
  el.style.backgroundPosition = 'center'
}

onMounted(() => void applyBackgroundImage())
watch(() => props.node.attr['backgroundImage.src'], () => void applyBackgroundImage())
</script>
