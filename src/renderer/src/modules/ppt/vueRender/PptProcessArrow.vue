<template>
  <div class="ppt-process" :class="`ppt-process--${direction}`" :data-node-id="node.id" :style="boxStyle">
    <div
      v-for="(step, i) in steps"
      :key="step.node.id ?? i"
      class="ppt-process__step"
      :data-node-id="step.node.id"
      :style="step.style"
    >
      <span>{{ step.label }}</span>
    </div>
  </div>
</template>
<script lang="ts" setup>
/**
 * ProcessArrow 流程箭头：连续箭头带（首块 homePlate 五边形，后续 chevron V 形，
 * clip-path 实现）。快照侧映射 PptxGenJS 的 homePlate / chevron 预设形状。
 */
import { computed, type CSSProperties } from 'vue'
import type { PptTheme, SlideNode } from '../pptTypes'
import { attrNum, commonStyle, resolveColor } from './attrStyle'

const props = defineProps<{ node: SlideNode; theme: PptTheme }>()

const attr = computed(() => props.node.attr)
const direction = computed(() => (attr.value.direction === 'vertical' ? 'vertical' : 'horizontal'))

const steps = computed(() => {
  const list = Array.isArray(props.node.child) ? props.node.child : []
  const filtered = list.filter((c) => c.tag === 'ProcessArrowStep')
  const w = attrNum(attr.value, 'itemWidth', 150)
  const h = attrNum(attr.value, 'itemHeight', 80)
  const gap = attrNum(attr.value, 'gap', -12) // 负值默认重叠成连续箭头带
  const fontSize = attrNum(attr.value, 'fontSize', 14)
  return filtered.map((node, i) => ({
    node,
    label: node.attr.label,
    style: {
      width: `${w}px`,
      height: `${h}px`,
      marginTop: direction.value === 'vertical' && i > 0 ? `${gap}px` : undefined,
      marginLeft: direction.value === 'horizontal' && i > 0 ? `${gap}px` : undefined,
      clipPath:
        direction.value === 'horizontal'
          ? i === 0
            ? 'polygon(0 0, calc(100% - 18px) 0, 100% 50%, calc(100% - 18px) 100%, 0 100%)'
            : 'polygon(0 0, calc(100% - 18px) 0, 100% 50%, calc(100% - 18px) 100%, 0 100%, 18px 50%)'
          : i === 0
            ? 'polygon(0 0, 100% 0, 100% calc(100% - 18px), 50% 100%, 0 calc(100% - 18px))'
            : 'polygon(0 0, 50% 18px, 100% 0, 100% calc(100% - 18px), 50% 100%, 0 calc(100% - 18px))',
      backgroundColor: resolveColor(node.attr.color, props.theme) ?? '#4472C4',
      color: resolveColor(node.attr.textColor, props.theme) ?? '#FFFFFF',
      fontSize: `${fontSize}px`,
      fontWeight: attr.value.bold === 'true' ? '700' : '400'
    } as CSSProperties
  }))
})

const boxStyle = computed<CSSProperties>(() => ({
  ...commonStyle(props.node, props.theme),
  display: 'flex',
  flexDirection: direction.value === 'horizontal' ? 'row' : 'column'
}))
</script>
<style scoped lang="less">
.ppt-process__step {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 14px;
  overflow: hidden;
}
</style>
