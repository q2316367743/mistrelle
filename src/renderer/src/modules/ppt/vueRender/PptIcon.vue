<template>
  <div class="ppt-icon" :data-node-id="node.id" :style="boxStyle">
    <div v-if="variant" class="ppt-icon__bg" :style="bgStyle" />
    <component :is="iconComp" v-if="iconComp" class="ppt-icon__glyph" :style="glyphStyle" />
  </div>
</template>
<script lang="ts" setup>
/**
 * Icon 图标节点（lucide 图标库）：name kebab-case → PascalCase 组件查找；
 * variant 变体（circle/square × filled/outlined）渲染底色块，图标叠加上层。
 */
import { computed, type CSSProperties } from 'vue'
import * as LucideIcons from 'lucide-vue-next'
import type { Component } from 'vue'
import type { PptTheme, SlideNode } from '../pptTypes'
import { attrNum, commonStyle, resolveColor } from './attrStyle'

const props = defineProps<{ node: SlideNode; theme: PptTheme }>()

const attr = computed(() => props.node.attr)
const size = computed(() => attrNum(attr.value, 'size', 24))

/** kebab-case → PascalCase（check-circle → CheckCircle） */
const iconComp = computed<Component | null>(() => {
  const pascal = (attr.value.name ?? '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
  const comp = (LucideIcons as unknown as Record<string, Component | undefined>)[pascal]
  return comp ?? null
})

const variant = computed(() => attr.value.variant)
const isCircle = computed(() => variant.value?.startsWith('circle') ?? false)

const boxStyle = computed<CSSProperties>(() => ({
  ...commonStyle(props.node, props.theme),
  position: 'relative',
  width: attr.value.w === undefined ? `${size.value}px` : undefined,
  height: attr.value.h === undefined ? `${size.value}px` : undefined,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
}))

const bgStyle = computed<CSSProperties>(() => ({
  position: 'absolute',
  inset: 0,
  borderRadius: isCircle.value ? '50%' : '18%',
  backgroundColor: resolveColor(attr.value.bgColor, props.theme) ?? '#E0E0E0',
  border:
    variant.value?.endsWith('outlined') === true
      ? `1.5px solid ${resolveColor(attr.value.color, props.theme) ?? '#000000'}`
      : undefined
}))

const glyphStyle = computed<CSSProperties>(() => ({
  width: variant.value ? '62%' : '100%',
  height: variant.value ? '62%' : '100%',
  color: resolveColor(attr.value.color, props.theme) ?? '#000000'
}))
</script>
<style scoped lang="less">
.ppt-icon__glyph {
  position: relative;
  flex-shrink: 0;
}
</style>
