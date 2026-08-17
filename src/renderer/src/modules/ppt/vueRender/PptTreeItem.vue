<template>
  <div class="ppt-tree-item" :class="`ppt-tree-item--${direction}`">
    <div class="ppt-tree-item__box" :data-node-id="node.id" :style="boxStyle">
      {{ node.attr.label }}
    </div>
    <div v-if="children.length" class="ppt-tree-item__children" :style="childrenStyle">
      <ppt-tree-item
        v-for="(child, i) in children"
        :key="child.id ?? i"
        :node="child"
        :theme="theme"
        :direction="direction"
        :shape="shape"
        :node-width="nodeWidth"
        :node-height="nodeHeight"
        :gap-x="gapX"
        :gap-y="gapY"
        :text-color="textColor"
      />
    </div>
  </div>
</template>
<script lang="ts" setup>
/** TreeItem 递归渲染（结构组件，连线由 PptTree 根组件测量绘制） */
import { computed, type CSSProperties } from 'vue'
import type { PptTheme, SlideNode } from '../pptTypes'
import { resolveColor } from './attrStyle'

const props = defineProps<{
  node: SlideNode
  theme: PptTheme
  direction: 'vertical' | 'horizontal'
  shape: string
  nodeWidth: number
  nodeHeight: number
  /** 同级间距（vertical 时为横向 gap；horizontal 时为纵向 gap） */
  gapX: number
  /** 层级间距（主轴方向 gap） */
  gapY: number
  textColor: string
}>()

const children = computed<SlideNode[]>(() =>
  Array.isArray(props.node.child) ? props.node.child.filter((c) => c.tag === 'TreeItem') : []
)

const boxStyle = computed<CSSProperties>(() => ({
  width: `${props.nodeWidth}px`,
  height: `${props.nodeHeight}px`,
  borderRadius:
    props.shape === 'ellipse' ? '50%' : props.shape === 'rect' ? '0px' : '8px',
  backgroundColor:
    resolveColor(props.node.attr.color, props.theme) ?? '#4472C4',
  color: resolveColor(props.node.attr.textColor, props.theme) ?? props.textColor,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '13px',
  textAlign: 'center',
  overflow: 'hidden',
  flexShrink: 0
}))

const childrenStyle = computed<CSSProperties>(() => ({
  display: 'flex',
  flexDirection: props.direction === 'vertical' ? 'row' : 'column',
  gap: `${props.direction === 'vertical' ? props.gapX : props.gapY}px`,
  marginTop: props.direction === 'vertical' ? `${props.gapY}px` : undefined,
  marginLeft: props.direction === 'horizontal' ? `${props.gapY}px` : undefined,
  alignItems: 'center'
}))
</script>
<style scoped lang="less">
.ppt-tree-item {
  display: flex;
  position: relative;

  &--vertical {
    flex-direction: column;
    align-items: center;
  }

  &--horizontal {
    flex-direction: row;
    align-items: center;
  }

  &__box {
    color: #fff;
  }
}
</style>
