<template>
  <div class="ppt-pyramid" :data-node-id="node.id" :style="boxStyle">
    <div
      v-for="(level, i) in levelItems"
      :key="level.node.id ?? i"
      class="ppt-pyramid__level"
      :data-node-id="level.node.id"
      :style="level.style"
    >
      <span>{{ level.label }}</span>
    </div>
  </div>
</template>
<script lang="ts">
/** Pyramid 金字塔：层级梯形（CSS clip-path），direction up/down。 */
import { computed, defineComponent, type CSSProperties } from 'vue'
import type { PptTheme, SlideNode } from '../pptTypes'
import { attrBool, attrNum, commonStyle, resolveColor } from './attrStyle'

interface LevelView {
  node: SlideNode
  label: string
  style: CSSProperties
}

export default defineComponent({
  name: 'PptPyramid',
  props: {
    node: { type: Object as () => SlideNode, required: true },
    theme: { type: Object as () => PptTheme, required: true }
  },
  setup(props) {
    const attr = computed(() => props.node.attr)
    const direction = computed(() => (attr.value.direction === 'down' ? 'down' : 'up'))
    const levelItems = computed<LevelView[]>(() => {
      const list = Array.isArray(props.node.child) ? props.node.child : []
      const filtered = list.filter((c) => c.tag === 'PyramidLevel')
      const total = filtered.length || 1
      const fontSize = attrNum(attr.value, 'fontSize', 14)
      const bold = attrBool(attr.value, 'bold') ?? true
      return filtered.map((level, index) => {
        const topRatio = index / total
        const bottomRatio = (index + 1) / total
        const topW = direction.value === 'up' ? topRatio : 1 - bottomRatio
        const botW = direction.value === 'up' ? bottomRatio : 1 - topRatio
        const leftTop = `${((1 - topW) / 2) * 100}%`
        const rightTop = `${((1 + topW) / 2) * 100}%`
        const leftBot = `${((1 - botW) / 2) * 100}%`
        const rightBot = `${((1 + botW) / 2) * 100}%`
        return {
          node: level,
          label: level.attr.label,
          style: {
            clipPath: `polygon(${leftTop} 0, ${rightTop} 0, ${rightBot} 100%, ${leftBot} 100%)`,
            backgroundColor: resolveColor(level.attr.color, props.theme) ?? '#4472C4',
            color: resolveColor(level.attr.textColor, props.theme) ?? '#FFFFFF',
            fontSize: `${fontSize}px`,
            fontWeight: bold ? '700' : '400',
            fontFamily: attr.value.fontFamily
          }
        }
      })
    })
    const boxStyle = computed<CSSProperties>(() => ({
      ...commonStyle(props.node, props.theme),
      display: 'flex',
      flexDirection: 'column',
      gap: '2px'
    }))
    return { node: props.node, levelItems, boxStyle }
  }
})
</script>
<style scoped lang="less">
.ppt-pyramid__level {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  overflow: hidden;
  padding: 0 12%;
}
</style>
