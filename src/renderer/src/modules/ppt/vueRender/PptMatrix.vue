<template>
  <div class="ppt-matrix" :data-node-id="node.id" :style="boxStyle">
    <div class="ppt-matrix__axes">
      <div class="ppt-matrix__axis ppt-matrix__axis--x" :style="axisStyle">↑ {{ axes?.attr.y }}</div>
      <div class="ppt-matrix__axis ppt-matrix__axis--y" :style="axisStyle">→ {{ axes?.attr.x }}</div>
    </div>
    <div class="ppt-matrix__grid">
      <div
        v-for="q in quadrants"
        :key="q.pos"
        class="ppt-matrix__quad"
        :class="`ppt-matrix__quad--${q.pos}`"
        :data-node-id="q.node.id"
        :style="quadStyle"
      >
        {{ q.label }}
      </div>
      <div
        v-for="(item, i) in items"
        :key="item.node.id ?? i"
        class="ppt-matrix__item"
        :data-node-id="item.node.id"
        :style="item.style"
      >
        <span class="ppt-matrix__dot" :style="item.dotStyle" />
        <span class="ppt-matrix__label">{{ item.node.attr.label }}</span>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
/**
 * Matrix 四象限矩阵：坐标轴标签 + 2×2 象限（MatrixQuadrants）+ 按比例定位的散点
 * （MatrixItem x/y 0-1，y=0 在下）。象限与散点均挂 data-node-id。
 */
import { computed, type CSSProperties } from 'vue'
import type { PptTheme, SlideNode } from '../pptTypes'
import { commonStyle, resolveColor } from './attrStyle'

const props = defineProps<{ node: SlideNode; theme: PptTheme }>()

const childList = computed<SlideNode[]>(() =>
  Array.isArray(props.node.child) ? props.node.child : []
)
const axes = computed(() => childList.value.find((c) => c.tag === 'MatrixAxes'))
const quadNode = computed(() => childList.value.find((c) => c.tag === 'MatrixQuadrants'))

const QUAD_POS = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const

const quadrants = computed(() =>
  QUAD_POS.map((pos) => ({
    pos,
    node: quadNode.value ?? props.node,
    label: quadNode.value?.attr[pos] ?? ''
  }))
)

const items = computed(() =>
  childList.value
    .filter((c) => c.tag === 'MatrixItem')
    .map((node) => {
      const x = Math.min(1, Math.max(0, Number(node.attr.x) || 0))
      const y = Math.min(1, Math.max(0, Number(node.attr.y) || 0))
      const color = resolveColor(node.attr.color, props.theme) ?? '#4472C4'
      return {
        node,
        style: {
          left: `${x * 100}%`,
          bottom: `${y * 100}%`,
          color: resolveColor(node.attr.textColor, props.theme) ?? '#1F2937'
        } as CSSProperties,
        dotStyle: { backgroundColor: color } as CSSProperties
      }
    })
)

const axisStyle = computed<CSSProperties>(() => ({
  color: resolveColor(props.node.attr.axisLabelColor, props.theme) ?? '#6B7280',
  fontSize: '12px'
}))

const quadStyle = computed<CSSProperties>(() => ({
  color: resolveColor(props.node.attr.quadrantLabelColor, props.theme) ?? '#9CA3AF',
  fontSize: '13px',
  fontWeight: '600'
}))

const boxStyle = computed<CSSProperties>(() => commonStyle(props.node, props.theme))
</script>
<style scoped lang="less">
.ppt-matrix {
  position: relative;
  display: flex;
  flex-direction: column;

  &__axes {
    position: relative;
    height: 18px;
    flex-shrink: 0;
  }

  &__axis {
    position: absolute;

    &--x {
      left: 0;
      top: 0;
    }

    &--y {
      right: 0;
      bottom: 0;
    }
  }

  &__grid {
    position: relative;
    flex: 1;
    min-height: 200px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    border: 1px solid rgba(0, 0, 0, 0.18);
    background: rgba(0, 0, 0, 0.02);
  }

  &__quad {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 8px;
    border: 0.5px solid rgba(0, 0, 0, 0.12);

    &--top-left {
      grid-area: 1 / 1;
    }

    &--top-right {
      grid-area: 1 / 2;
    }

    &--bottom-left {
      grid-area: 2 / 1;
    }

    &--bottom-right {
      grid-area: 2 / 2;
    }
  }

  &__item {
    position: absolute;
    transform: translate(-50%, 50%);
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 13px;
    white-space: nowrap;
  }

  &__dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }
}
</style>
