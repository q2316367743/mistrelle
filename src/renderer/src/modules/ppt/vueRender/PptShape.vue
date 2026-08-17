<template>
  <div class="ppt-shape" :data-node-id="node.id" :style="boxStyle">
    <!-- rect / roundRect / ellipse：CSS 盒实现（圆角 / 50% 半径） -->
    <div v-if="!pathData" class="ppt-shape__fill" :style="fillStyle" />
    <!-- 其余预设形状：SVG path（viewBox 100×100 非等比拉伸，与 PowerPoint 预设几何一致） -->
    <svg v-else class="ppt-shape__svg" viewBox="0 0 100 100" preserveAspectRatio="none">
      <path :d="pathData" :fill="fillCss" :stroke="strokeCss" :stroke-width="strokeWidth" />
    </svg>
    <div v-if="text" class="ppt-shape__text" :style="textCss">{{ text }}</div>
  </div>
</template>
<script lang="ts" setup>
/**
 * Shape 形状节点：shapeType 分流——rect/roundRect/ellipse 走 CSS 盒（圆角），
 * 其余用 SVG path 子集（shapePaths，未收录回退 rect）；child 字符串居中渲染为形状文本。
 * 填充默认 4472C4（模块约定），fill.transparency 作用于填充色。
 */
import { computed, type CSSProperties } from 'vue'
import type { PptTheme, SlideNode } from '../pptTypes'
import { attrNum, commonStyle, hexToRgba, resolveColor, textStyle, toHex } from './attrStyle'
import { isEllipseShape, shapePath } from './shapePaths'

const props = defineProps<{ node: SlideNode; theme: PptTheme }>()

const attr = computed(() => props.node.attr)
const shapeType = computed(() => attr.value.shapeType ?? 'rect')
const pathData = computed(() =>
  shapeType.value === 'rect' || shapeType.value === 'roundRect' || isEllipseShape(shapeType.value)
    ? null
    : (shapePath(shapeType.value) ?? null)
)

const text = computed(() => (typeof props.node.child === 'string' ? props.node.child : ''))

/** 填充色（含透明度）；无填充配置回退默认主题蓝 */
const fillCss = computed(() => {
  const color = resolveColor(attr.value['fill.color'], props.theme) ?? '#4472C4'
  const transparency = attrNum(attr.value, 'fill.transparency', 0)
  const alpha = 1 - Math.min(1, Math.max(0, transparency))
  return hexToRgba(toHex(color), alpha)
})

const strokeCss = computed(() => resolveColor(attr.value['line.color'], props.theme) ?? 'none')
const strokeWidth = computed(() => attrNum(attr.value, 'line.width', 1))

const boxStyle = computed<CSSProperties>(() => ({
  ...commonStyle(props.node, props.theme),
  position: 'relative'
}))

/** CSS 盒形状的填充（背景）与圆角 */
const fillStyle = computed<CSSProperties>(() => {
  const style: CSSProperties = { position: 'absolute', inset: 0, backgroundColor: fillCss.value }
  if (isEllipseShape(shapeType.value)) style.borderRadius = '50%'
  else if (shapeType.value === 'roundRect') {
    const radius = attrNum(attr.value, 'borderRadius', NaN)
    style.borderRadius = Number.isFinite(radius) ? `${radius}px` : '14%'
  }
  const line = resolveColor(attr.value['line.color'], props.theme)
  if (line) {
    style.border = `${strokeWidth.value}px solid ${line}`
  }
  return style
})

/** 形状内文本：绝对铺满 + 双向居中（PowerPoint 形状文本默认居中），文本样式 attr 可覆盖对齐 */
const textCss = computed<CSSProperties[]>(() => [
  {
    ...textStyle(attr.value, props.theme),
    textAlign:
      attr.value.textAlign === 'left' || attr.value.textAlign === 'right' || attr.value.textAlign === 'center'
        ? attr.value.textAlign
        : 'center'
  }
])
</script>
<style scoped lang="less">
.ppt-shape {
  position: relative;

  &__svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  &__text {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    white-space: pre-wrap;
    overflow-wrap: break-word;
  }
}
</style>
