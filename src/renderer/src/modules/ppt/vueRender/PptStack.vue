<template>
  <div
    class="ppt-stack"
    :class="node.tag === 'HStack' ? 'ppt-stack--h' : 'ppt-stack--v'"
    :data-node-id="node.id"
    :style="style"
  >
    <ppt-node v-for="(child, i) in children" :key="child.id ?? i" :node="child" :theme="theme" />
  </div>
</template>
<script lang="ts" setup>
/**
 * VStack / HStack 布局容器 → CSS flex（POM 的 yoga 引擎即 Web flexbox 移植，
 * 语义一致：alignItems 默认 stretch、justifyContent 默认 start、子项默认不收缩）。
 */
import { computed, type CSSProperties } from 'vue'
import type { PptTheme, SlideNode } from '../pptTypes'
import { attrNum, commonStyle } from './attrStyle'
import PptNode from './PptNode.vue'

const props = defineProps<{ node: SlideNode; theme: PptTheme }>()

const children = computed<SlideNode[]>(() =>
  Array.isArray(props.node.child) ? props.node.child : []
)

const JUSTIFY: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  spaceBetween: 'space-between',
  spaceAround: 'space-around',
  spaceEvenly: 'space-evenly'
}
const ALIGN: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch'
}

const style = computed<CSSProperties>(() => {
  const attr = props.node.attr
  const flex: CSSProperties = {
    display: 'flex',
    flexDirection: props.node.tag === 'HStack' ? 'row' : 'column'
  }
  const gap = attrNum(attr, 'gap', NaN)
  if (Number.isFinite(gap)) flex.gap = `${gap}px`
  if (attr.alignItems) flex.alignItems = ALIGN[attr.alignItems]
  if (attr.justifyContent) flex.justifyContent = JUSTIFY[attr.justifyContent]
  if (attr.flexWrap) {
    flex.flexWrap =
      attr.flexWrap === 'wrapReverse' ? 'wrap-reverse' : attr.flexWrap === 'wrap' ? 'wrap' : 'nowrap'
  }
  return { ...commonStyle(props.node, props.theme), ...flex }
})
</script>
<style scoped lang="less">
// yoga 默认 flexShrink=0（与 CSS 默认 1 不同）：子项溢出而不压缩，与 POM 行为一致
.ppt-stack > * {
  flex-shrink: 0;
}
</style>
