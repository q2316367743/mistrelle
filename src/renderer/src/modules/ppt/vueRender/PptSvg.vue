<template>
  <div
    class="ppt-svg"
    :data-node-id="node.id"
    :style="boxStyle"
    :data-ppt-svg="node.attr.svgContent ? '1' : undefined"
  >
    <div class="ppt-svg__content" v-html="svgContent" />
  </div>
</template>
<script lang="ts" setup>
/**
 * Svg 内联 SVG 节点：svgContent 以 v-html 注入（内容来自 AI 生成 / 校验层过滤的
 * SVG 字符串，与画布模块内联 SVG 同策略）；w/h 仅接受数字（schema 约束）。
 * 根元素标记 data-ppt-svg 供快照序列化提取。
 */
import { computed, type CSSProperties } from 'vue'
import type { PptTheme, SlideNode } from '../pptTypes'
import { attrNum, commonStyle, resolveColor } from './attrStyle'

const props = defineProps<{ node: SlideNode; theme: PptTheme }>()

const svgContent = computed(() => props.node.attr.svgContent ?? '')

const boxStyle = computed<CSSProperties>(() => {
  const style: CSSProperties = { ...commonStyle(props.node, props.theme) }
  const w = attrNum(props.node.attr, 'w', NaN)
  const h = attrNum(props.node.attr, 'h', NaN)
  if (Number.isFinite(w)) style.width = `${w}px`
  if (Number.isFinite(h)) style.height = `${h}px`
  const color = resolveColor(props.node.attr.color, props.theme)
  if (color) style.color = color
  return style
})
</script>
<style scoped lang="less">
.ppt-svg {
  position: relative;

  &__content {
    width: 100%;
    height: 100%;

    :deep(svg) {
      display: block;
      width: 100%;
      height: 100%;
    }
  }
}
</style>
