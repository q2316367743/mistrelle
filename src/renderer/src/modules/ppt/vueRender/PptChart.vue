<template>
  <div ref="hostRef" class="ppt-chart" :data-node-id="node.id" :style="boxStyle">
    <div class="ppt-chart__svg" v-html="svg" />
  </div>
</template>
<script lang="ts" setup>
/**
 * Chart 图表节点：attr.data（JSON 系列）→ echarts option → 复用 design/chartRender 的
 * SSR SVG 渲染（无实例生命周期，静态矢量图，与画布模块同源实现）。容器尺寸变化
 * （ResizeObserver）与 data 变更时按新尺寸重渲染。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PptTheme, SlideNode } from '../pptTypes'
import { commonStyle } from './attrStyle'
import { buildChartOption } from './chartOption'
import { renderChartOptionToSVG } from '@/modules/tool/components/design/chartRender'

const props = defineProps<{ node: SlideNode; theme: PptTheme }>()

const hostRef = ref<HTMLElement | null>(null)
const svg = ref('')
let observer: ResizeObserver | null = null
let renderToken = 0

const rerender = async (): Promise<void> => {
  const host = hostRef.value
  if (!host) return
  const token = ++renderToken
  const width = Math.max(1, Math.round(host.offsetWidth || 320))
  const height = Math.max(1, Math.round(host.offsetHeight || 240))
  const result = await renderChartOptionToSVG(buildChartOption(props.node.attr), width, height)
  if (token === renderToken) svg.value = result
}

onMounted(() => {
  void rerender()
  observer = new ResizeObserver(() => void rerender())
  if (hostRef.value) observer.observe(hostRef.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

watch(
  () => props.node.attr,
  () => void rerender(),
  { deep: true }
)

const boxStyle = computed(() => {
  const style = commonStyle(props.node, props.theme)
  const w = props.node.attr.w
  const h = props.node.attr.h
  if (w === undefined) style.flexGrow = style.flexGrow ?? 1
  if (w === undefined && h === undefined) style.minHeight = '160px'
  return style
})
</script>
<style scoped lang="less">
.ppt-chart {
  position: relative;
  min-width: 0;

  &__svg {
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
