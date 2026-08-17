<template>
  <div class="ppt-list" :data-node-id="node.id" :style="style">
    <div
      v-for="(li, i) in items"
      :key="li.id ?? i"
      class="ppt-list__item"
      :data-node-id="li.id"
    >
      <span class="ppt-list__marker" :style="markerStyle(li)">{{ markerOf(i) }}</span>
      <div class="ppt-list__text" :style="liStyle(li)">{{ liText(li) }}</div>
    </div>
  </div>
</template>
<script lang="ts" setup>
/**
 * Ul / Ol 列表节点：Li 子项 = 行（marker + 文本两段，快照按两段测量）。
 * Ol 编号样式 numberType（arabicPlain / arabicPeriod / romanLcPeriod 等）+ numberStartAt；
 * 文本样式 Li attr 优先，缺省回退列表级 attr（对齐 POM 继承语义）。
 */
import { computed, type CSSProperties } from 'vue'
import type { PptTheme, SlideNode } from '../pptTypes'
import { attrNum, commonStyle, textStyle } from './attrStyle'

const props = defineProps<{ node: SlideNode; theme: PptTheme }>()

const items = computed<SlideNode[]>(() =>
  Array.isArray(props.node.child)
    ? props.node.child.filter((child) => child.tag === 'Li')
    : []
)

const isOl = computed(() => props.node.tag === 'Ol')

/** 罗马数字（1-3999） */
const toRoman = (n: number, lowercase: boolean): string => {
  const table: Array<[number, string]> = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ]
  let value = n
  let result = ''
  for (const [num, sym] of table) {
    while (value >= num) {
      result += sym
      value -= num
    }
  }
  return lowercase ? result.toLowerCase() : result
}

const markerOf = (index: number): string => {
  if (!isOl.value) return '•'
  const n = index + attrNum(props.node.attr, 'numberStartAt', 1)
  const type = props.node.attr.numberType ?? 'arabicPeriod'
  if (type === 'arabicPlain') return `${n}`
  if (type === 'arabicParenR') return `${n})`
  if (type === 'arabicParenBoth') return `(${n})`
  if (type.startsWith('roman')) {
    const roman = toRoman(n, type.includes('Lc'))
    return type.endsWith('Period') ? `${roman}.` : type.endsWith('ParenR') ? `${roman})` : roman
  }
  if (type.startsWith('alpha')) {
    const letter = String.fromCharCode(65 + ((n - 1) % 26)) // Lc 变体统一大写近似
    return type.endsWith('Period') ? `${letter}.` : letter
  }
  return `${n}.`
}

const style = computed<CSSProperties[]>(() => [
  commonStyle(props.node, props.theme),
  textStyle(props.node.attr, props.theme)
])

const markerStyle = (li: SlideNode): CSSProperties => textStyle(li.attr, props.theme, props.node.attr)

const liStyle = (li: SlideNode): CSSProperties => textStyle(li.attr, props.theme, props.node.attr)

const liText = (li: SlideNode): string => (typeof li.child === 'string' ? li.child : '')
</script>
<style scoped lang="less">
.ppt-list {
  display: flex;
  flex-direction: column;

  &__item {
    display: flex;
    align-items: baseline;
  }

  &__marker {
    flex-shrink: 0;
    white-space: pre;
  }

  &__text {
    flex: 1;
    min-width: 0;
    white-space: pre-wrap;
    overflow-wrap: break-word;
  }
}
</style>
