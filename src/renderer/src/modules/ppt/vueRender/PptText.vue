<template>
  <div class="ppt-text" :data-node-id="node.id" :style="style">{{ text }}</div>
</template>
<script lang="ts" setup>
/**
 * Text 文本节点：child 字符串按原样渲染（white-space: pre-wrap 保留换行与空格，
 * CJK 任意断行 / 拉丁按词断行，与 PowerPoint 换行行为近似）。
 */
import { computed, type CSSProperties } from 'vue'
import type { PptTheme, SlideNode } from '../pptTypes'
import { commonStyle, textStyle } from './attrStyle'

const props = defineProps<{ node: SlideNode; theme: PptTheme }>()

const text = computed(() => (typeof props.node.child === 'string' ? props.node.child : ''))

const style = computed<CSSProperties[]>(() => [
  commonStyle(props.node, props.theme),
  textStyle(props.node.attr, props.theme)
])
</script>
<style scoped lang="less">
.ppt-text {
  white-space: pre-wrap;
  overflow-wrap: break-word;
}
</style>
