<template>
  <div ref="hostRef" class="ppt-flow" :data-node-id="node.id" :style="boxStyle">
    <div class="ppt-flow__nodes" :class="`ppt-flow__nodes--${direction}`">
      <div
        v-for="(n, i) in flowNodes"
        :key="n.node.id ?? i"
        class="ppt-flow__node"
        :data-node-id="n.node.id"
        :data-flow-id="n.flowId"
        :style="n.style"
      >
        {{ n.text }}
      </div>
    </div>
    <svg class="ppt-flow__links" width="100%" height="100%">
      <g v-for="link in links" :key="link.key" :data-node-id="link.nodeId">
        <line
          :x1="link.x1"
          :y1="link.y1"
          :x2="link.x2"
          :y2="link.y2"
          :stroke="link.color"
          :stroke-width="link.width"
          :stroke-dasharray="link.dash"
        />
        <polygon
          v-if="link.arrowPoints"
          :points="link.arrowPoints"
          :fill="link.color"
        />
        <text
          v-if="link.label"
          :x="(link.x1 + link.x2) / 2"
          :y="(link.y1 + link.y2) / 2 - 5"
          text-anchor="middle"
          :font-size="11"
          :fill="link.labelColor"
        >
          {{ link.label }}
        </text>
      </g>
    </svg>
  </div>
</template>
<script lang="ts" setup>
/**
 * Flow 流程图：FlowNode 按声明顺序沿方向排布（横向 flex wrap / 纵向列），
 * FlowConnection 挂载后按 data-flow-id 测量两端节点 → 中心线裁剪到边框 + 箭头 / 标签
 * （overlay svg 绝对铺满；连接组挂 data-node-id 供点选与快照提取 x1y1x2y2）。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from 'vue'
import type { PptTheme, SlideNode } from '../pptTypes'
import { attrNum, commonStyle, resolveColor } from './attrStyle'
import { arrowKind, arrowPointsStr, dashArray, localRect, segmentAngle, trimCenters } from './overlayLinks'

const props = defineProps<{ node: SlideNode; theme: PptTheme }>()

const hostRef = ref<HTMLElement | null>(null)
const attr = computed(() => props.node.attr)
const direction = computed(() => (attr.value.direction === 'vertical' ? 'vertical' : 'horizontal'))

const childList = computed<SlideNode[]>(() =>
  Array.isArray(props.node.child) ? props.node.child : []
)

const flowNodes = computed(() =>
  childList.value
    .filter((c) => c.tag === 'FlowNode')
    .map((node) => ({
      node,
      flowId: node.attr.id,
      text: node.attr.text,
      style: {
        width: `${attrNum(node.attr, 'width', NaN) || attrNum(attr.value, 'nodeWidth', 120)}px`,
        height: `${attrNum(node.attr, 'height', NaN) || attrNum(attr.value, 'nodeHeight', 60)}px`,
        backgroundColor: resolveColor(node.attr.color, props.theme) ?? '#4472C4',
        color: resolveColor(node.attr.textColor, props.theme) ?? '#FFFFFF',
        borderRadius: node.attr.shape === 'flowChartTerminator' ? '999px' : node.attr.shape === 'flowChartProcess' ? '6px' : node.attr.shape === 'flowChartDecision' ? '0px' : '6px'
      } as CSSProperties
    }))
)

interface FlowLink {
  key: string
  nodeId?: string
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  width: number
  dash?: string
  arrowPoints?: string
  label?: string
  labelColor: string
}

const links = ref<FlowLink[]>([])

const redraw = (): void => {
  const host = hostRef.value
  if (!host) return
  const base = host.getBoundingClientRect()
  const els = new Map<string, HTMLElement>()
  host.querySelectorAll<HTMLElement>('[data-flow-id]').forEach((el) => {
    els.set(el.dataset.flowId ?? '', el)
  })
  const result: FlowLink[] = []
  childList.value
    .filter((c) => c.tag === 'FlowConnection')
    .forEach((conn, i) => {
      const fromEl = els.get(conn.attr.from)
      const toEl = els.get(conn.attr.to)
      if (!fromEl || !toEl) return
      const seg = trimCenters(localRect(fromEl, base), localRect(toEl, base))
      const color =
        resolveColor(conn.attr.color, props.theme) ??
        resolveColor(attr.value['connectorStyle.color'], props.theme) ??
        '#6B7280'
      const width = attrNum(attr.value, 'connectorStyle.width', 1.5)
      const hasArrow = arrowKind(conn.attr.endArrow ?? attr.value['connectorStyle.arrowType'] ?? 'true') !== null
      result.push({
        key: conn.id ?? `conn-${i}`,
        nodeId: conn.id,
        ...seg,
        color,
        width,
        dash: dashArray(attr.value['connectorStyle.dashType'] ?? conn.attr.dashType),
        arrowPoints: hasArrow
          ? arrowPointsStr(
              seg.x2,
              seg.y2,
              segmentAngle(seg.x1, seg.y1, seg.x2, seg.y2),
              9
            )
          : undefined,
        label: conn.attr.label,
        labelColor:
          resolveColor(conn.attr.labelColor, props.theme) ??
          resolveColor(attr.value['connectorStyle.labelColor'], props.theme) ??
          '#374151'
      })
    })
  links.value = result
}

onMounted(() => {
  void nextTick(redraw)
  observer = new ResizeObserver(() => redraw())
  if (hostRef.value) observer.observe(hostRef.value)
})
let observer: ResizeObserver | null = null
onBeforeUnmount(() => observer?.disconnect())
watch(() => props.node.child, () => void nextTick(redraw), { deep: true })

const boxStyle = computed<CSSProperties>(() => ({
  ...commonStyle(props.node, props.theme),
  position: 'relative'
}))
</script>
<style scoped lang="less">
.ppt-flow {
  position: relative;

  &__nodes {
    display: flex;
    gap: 40px;

    &--horizontal {
      flex-direction: row;
      flex-wrap: wrap;
      row-gap: 20px;
    }

    &--vertical {
      flex-direction: column;
      gap: 20px;
    }
  }

  &__node {
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 4px;
    font-size: 13px;
    line-height: 1.3;
    color: #fff;
    overflow-wrap: break-word;
  }

  &__links {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: visible;
  }
}
</style>
