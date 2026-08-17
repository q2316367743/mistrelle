<template>
  <div ref="hostRef" class="ppt-surface" :data-ppt-surface="size.w + 'x' + size.h" :style="surfaceStyle">
    <div class="ppt-surface__roots">
      <ppt-node v-for="(root, i) in roots" :key="root.id ?? i" :node="root" :theme="theme" />
    </div>
    <svg class="ppt-surface__overlay" width="100%" height="100%">
      <g v-for="item in overlayItems" :key="item.key" :data-node-id="item.nodeId">
        <line
          :x1="item.x1"
          :y1="item.y1"
          :x2="item.x2"
          :y2="item.y2"
          :stroke="item.color"
          :stroke-width="item.width"
          :stroke-dasharray="item.dash"
        />
        <polygon v-if="item.beginPoints" :points="item.beginPoints" :fill="item.color" />
        <polygon v-if="item.endPoints" :points="item.endPoints" :fill="item.color" />
      </g>
    </svg>
  </div>
</template>
<script lang="ts" setup>
/**
 * PPT 页面画布（自研渲染层根组件）：
 * - 固定 PPT_SLIDE_SIZE 画布，根节点数组按隐式 VStack（flex column）排布（与 POM 语义一致）
 * - Line（绝对坐标）与 Arrow（from/to 引用节点，挂载后测量端点）统一绘制在 overlay svg
 * - 根元素标记 data-ppt-surface，供点选与快照定位测量基准
 * 外层缩放由父容器 transform 控制（预览平移缩放 / 缩略图等比缩小共用）。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from 'vue'
import type { PptTheme, SlideNode } from '../pptTypes'
import { PPT_SLIDE_SIZE } from '../pptTypes'
import { attrNum, resolveColor } from './attrStyle'
import {
  arrowKind,
  arrowPointsStr,
  dashArray,
  edgePoint,
  localRect,
  segmentAngle
} from './overlayLinks'
import PptNode from './PptNode.vue'

const props = defineProps<{
  slide: SlideNode[]
  theme: PptTheme
  /** 画布尺寸（缺省 1280×720） */
  size?: { w: number; h: number }
}>()

const size = computed(() => props.size ?? PPT_SLIDE_SIZE)
const hostRef = ref<HTMLElement | null>(null)

/** 深遍历收集指定 tag 的节点（Line / Arrow 不参与布局，抽到 overlay） */
const collectByTag = (tags: string[]): SlideNode[] => {
  const result: SlideNode[] = []
  const walk = (nodes: SlideNode[]): void => {
    for (const node of nodes) {
      if (tags.includes(node.tag)) result.push(node)
      if (Array.isArray(node.child)) walk(node.child)
    }
  }
  walk(props.slide)
  return result
}

const isOverlayTag = (tag: string): boolean => tag === 'Line' || tag === 'Arrow'

const roots = computed<SlideNode[]>(() =>
  props.slide.filter((node) => !isOverlayTag(node.tag))
)

interface OverlayItem {
  key: string
  nodeId?: string
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  width: number
  dash?: string
  beginPoints?: string
  endPoints?: string
}

const overlayItems = ref<OverlayItem[]>([])

/** Line 节点 → overlay 项（绝对坐标即画布坐标） */
const lineItems = (): OverlayItem[] =>
  collectByTag(['Line']).map((node, i) => {
    const a = node.attr
    const x1 = attrNum(a, 'x1', 0)
    const y1 = attrNum(a, 'y1', 0)
    const x2 = attrNum(a, 'x2', 0)
    const y2 = attrNum(a, 'y2', 0)
    const color = resolveColor(a.color, props.theme) ?? '#000000'
    const width = Number(a.lineWidth) || 1
    const end = a.endArrow === undefined ? a['endArrow.type'] : a.endArrow
    const begin = a.beginArrow === undefined ? a['beginArrow.type'] : a.beginArrow
    return {
      key: node.id ?? `line-${i}`,
      nodeId: node.id,
      x1,
      y1,
      x2,
      y2,
      color,
      width,
      dash: dashArray(a.dashType),
      beginPoints: arrowKind(begin)
        ? arrowPointsStr(x1, y1, segmentAngle(x2, y2, x1, y1), 9)
        : undefined,
      endPoints: arrowKind(end)
        ? arrowPointsStr(x2, y2, segmentAngle(x1, y1, x2, y2), 9)
        : undefined
    }
  })

/** Arrow 节点 → overlay 项（from/to 引用节点元素，边框交点锚定） */
const arrowItems = (): OverlayItem[] => {
  const host = hostRef.value
  if (!host) return []
  const base = host.getBoundingClientRect()
  // id 索引：顶层 node.id 与 attr.id（POM 功能标识）都可被引用
  const els = new Map<string, Element>()
  const walk = (nodes: SlideNode[]): void => {
    for (const node of nodes) {
      if (node.id && !isOverlayTag(node.tag)) {
        const el = host.querySelector(`[data-node-id="${node.id}"]`)
        if (el) {
          els.set(node.id, el)
          if (node.attr.id) els.set(node.attr.id, el)
        }
      }
      if (Array.isArray(node.child)) walk(node.child)
    }
  }
  walk(props.slide)
  return collectByTag(['Arrow']).flatMap((node, i) => {
    const a = node.attr
    const fromEl = els.get(a.from)
    const toEl = els.get(a.to)
    if (!fromEl || !toEl) return []
    const from = localRect(fromEl, base)
    const to = localRect(toEl, base)
    const fromAnchor = edgePoint(from, to.x + to.w / 2, to.y + to.h / 2)
    const toAnchor = edgePoint(to, from.x + from.w / 2, from.y + from.h / 2)
    const color = resolveColor(a.color, props.theme) ?? '#000000'
    const width = Number(a.lineWidth) || 1.5
    const end = a.endArrow === undefined ? a['endArrow.type'] : a.endArrow
    const begin = a.beginArrow === undefined ? a['beginArrow.type'] : a.beginArrow
    return [
      {
        key: node.id ?? `arrow-${i}`,
        nodeId: node.id,
        x1: fromAnchor.x,
        y1: fromAnchor.y,
        x2: toAnchor.x,
        y2: toAnchor.y,
        color,
        width,
        dash: dashArray(a.dashType),
        beginPoints: arrowKind(begin)
          ? arrowPointsStr(
              fromAnchor.x,
              fromAnchor.y,
              segmentAngle(toAnchor.x, toAnchor.y, fromAnchor.x, fromAnchor.y),
              9
            )
          : undefined,
        endPoints: arrowKind(end)
          ? arrowPointsStr(
              toAnchor.x,
              toAnchor.y,
              segmentAngle(fromAnchor.x, fromAnchor.y, toAnchor.x, toAnchor.y),
              9
            )
          : undefined
      }
    ]
  })
}

const redraw = (): void => {
  overlayItems.value = [...lineItems(), ...arrowItems()]
}

let observer: ResizeObserver | null = null
onMounted(() => {
  void nextTick(redraw)
  observer = new ResizeObserver(() => redraw())
  if (hostRef.value) observer.observe(hostRef.value)
})
onBeforeUnmount(() => observer?.disconnect())
watch(
  () => props.slide,
  () => void nextTick(redraw),
  { deep: true }
)

const surfaceStyle = computed<CSSProperties>(() => ({
  width: `${size.value.w}px`,
  height: `${size.value.h}px`,
  position: 'relative',
  backgroundColor: '#FFFFFF',
  overflow: 'hidden',
  flexShrink: 0
}))
</script>
<style scoped lang="less">
.ppt-surface {
  &__roots {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: stretch;

    // 隐式 VStack 语义（同 PptStack：子项不压缩）
    & > * {
      flex-shrink: 0;
    }
  }

  &__overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;

    [data-node-id] {
      pointer-events: auto;
      cursor: pointer;
    }
  }
}
</style>
