<template>
  <div ref="hostRef" class="ppt-tree" :data-node-id="node.id" :style="boxStyle">
    <ppt-tree-item
      v-for="(root, i) in roots"
      :key="root.id ?? i"
      :node="root"
      :theme="theme"
      :direction="direction"
      :shape="shape"
      :node-width="nodeWidth"
      :node-height="nodeHeight"
      :gap-x="siblingGap"
      :gap-y="levelGap"
      :text-color="textColor"
    />
    <svg class="ppt-tree__links" width="100%" height="100%">
      <line
        v-for="(link, i) in links"
        :key="i"
        v-bind="link"
      />
    </svg>
  </div>
</template>
<script lang="ts" setup>
/**
 * Tree 树形结构：PptTreeItem 递归布局（vertical 上下 / horizontal 左右），
 * 连线挂载后测量各 TreeItem 盒（data-node-id）从父边到子边绘制。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from 'vue'
import type { PptTheme, SlideNode } from '../pptTypes'
import { attrNum, commonStyle, resolveColor } from './attrStyle'
import { localRect } from './overlayLinks'
import PptTreeItem from './PptTreeItem.vue'

const props = defineProps<{ node: SlideNode; theme: PptTheme }>()

const hostRef = ref<HTMLElement | null>(null)
const attr = computed(() => props.node.attr)
const direction = computed(() => (attr.value.layout === 'horizontal' ? 'horizontal' : 'vertical'))
const shape = computed(() => attr.value.nodeShape ?? 'roundRect')
const nodeWidth = computed(() => attrNum(attr.value, 'nodeWidth', 120))
const nodeHeight = computed(() => attrNum(attr.value, 'nodeHeight', 40))
const levelGap = computed(() => attrNum(attr.value, 'levelGap', 60) / 2)
const siblingGap = computed(() => attrNum(attr.value, 'siblingGap', 20))
const textColor = computed(
  () => resolveColor(attr.value.textColor, props.theme) ?? '#FFFFFF'
)

const roots = computed<SlideNode[]>(() =>
  (Array.isArray(props.node.child) ? props.node.child : []).filter((c) => c.tag === 'TreeItem')
)

interface TreeLink {
  x1: number
  y1: number
  x2: number
  y2: number
  stroke: string
  'stroke-width': number
}

const links = ref<TreeLink[]>([])

/** 收集 (父, 子) TreeItem 对 */
const parentChildPairs = (): Array<[SlideNode, SlideNode]> => {
  const pairs: Array<[SlideNode, SlideNode]> = []
  const walk = (item: SlideNode): void => {
    for (const child of Array.isArray(item.child) ? item.child : []) {
      if (child.tag === 'TreeItem') {
        pairs.push([item, child])
        walk(child)
      }
    }
  }
  roots.value.forEach(walk)
  return pairs
}

const redraw = (): void => {
  const host = hostRef.value
  if (!host) return
  const base = host.getBoundingClientRect()
  const color = resolveColor(attr.value['connectorStyle.color'], props.theme) ?? '#9CA3AF'
  const width = attrNum(attr.value, 'connectorStyle.width', 1.5)
  const result: TreeLink[] = []
  for (const [parent, child] of parentChildPairs()) {
    const parentEl = parent.id ? host.querySelector(`[data-node-id="${parent.id}"]`) : null
    const childEl = child.id ? host.querySelector(`[data-node-id="${child.id}"]`) : null
    if (!parentEl || !childEl) continue
    const pr = localRect(parentEl, base)
    const cr = localRect(childEl, base)
    // 父子锚点：主轴方向边中点相连（vertical: 父底→子顶；horizontal: 父右→子左）
    if (direction.value === 'vertical') {
      result.push({
        x1: pr.x + pr.w / 2,
        y1: pr.y + pr.h,
        x2: cr.x + cr.w / 2,
        y2: cr.y,
        stroke: color,
        'stroke-width': width
      })
    } else {
      result.push({
        x1: pr.x + pr.w,
        y1: pr.y + pr.h / 2,
        x2: cr.x,
        y2: cr.y + cr.h / 2,
        stroke: color,
        'stroke-width': width
      })
    }
  }
  links.value = result
}

let observer: ResizeObserver | null = null
onMounted(() => {
  void nextTick(redraw)
  observer = new ResizeObserver(() => redraw())
  if (hostRef.value) observer.observe(hostRef.value)
})
onBeforeUnmount(() => observer?.disconnect())
watch(() => props.node.child, () => void nextTick(redraw), { deep: true })

const boxStyle = computed<CSSProperties>(() => ({
  ...commonStyle(props.node, props.theme),
  position: 'relative',
  display: 'flex',
  justifyContent: 'center'
}))
</script>
<style scoped lang="less">
.ppt-tree {
  &__links {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: visible;
  }
}
</style>
