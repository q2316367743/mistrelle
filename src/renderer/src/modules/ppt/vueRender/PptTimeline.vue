<template>
  <div class="ppt-timeline" :class="`ppt-timeline--${direction}`" :data-node-id="node.id" :style="boxStyle">
    <div class="ppt-timeline__track" :style="trackStyle" />
    <div
      v-for="(item, i) in items"
      :key="item.node.id ?? i"
      class="ppt-timeline__item"
      :data-node-id="item.node.id"
    >
      <div class="ppt-timeline__date" :style="item.dateStyle">{{ item.date }}</div>
      <div class="ppt-timeline__dot" :style="item.dotStyle" />
      <div class="ppt-timeline__title" :style="item.titleStyle">{{ item.title }}</div>
      <div v-if="item.description" class="ppt-timeline__desc" :style="item.descStyle">
        {{ item.description }}
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
/**
 * Timeline 时间线：horizontal（横向，连接线贯穿中部）/ vertical（纵向，左侧连线）。
 * 每项 = 日期 + 圆点（主题色）+ 标题 + 描述，TimelineItem 挂 data-node-id 供点选 / 快照。
 */
import { computed, type CSSProperties } from 'vue'
import type { PptTheme, SlideNode } from '../pptTypes'
import { commonStyle, resolveColor, textStyle } from './attrStyle'

const props = defineProps<{ node: SlideNode; theme: PptTheme }>()

const direction = computed(() => (props.node.attr.direction === 'vertical' ? 'vertical' : 'horizontal'))
const attr = computed(() => props.node.attr)

const items = computed(() =>
  (Array.isArray(props.node.child) ? props.node.child : []).map((node) => {
    const a = node.attr
    const itemColor =
      resolveColor(a.color, props.theme) ??
      resolveColor(a.dateColor, props.theme) ??
      '#4472C4'
    return {
      node,
      date: a.date,
      title: a.title,
      description: a.description,
      dotStyle: { backgroundColor: itemColor } as CSSProperties,
      dateStyle: {
        ...textStyle({}, props.theme),
        fontSize: '13px',
        fontWeight: '600',
        color:
          (a.dateColor ? resolveColor(a.dateColor, props.theme) : undefined) ??
          (attr.value.useColorForDate === 'true' ? itemColor : undefined) ??
          resolveColor(attr.value.dateColor, props.theme) ??
          itemColor
      } as CSSProperties,
      titleStyle: {
        ...textStyle({}, props.theme),
        fontSize: '16px',
        fontWeight: '700',
        color: resolveColor(attr.value.titleColor, props.theme) ?? '#1F2937'
      } as CSSProperties,
      descStyle: {
        ...textStyle({}, props.theme),
        fontSize: '13px',
        lineHeight: 1.4,
        color: resolveColor(attr.value.descriptionColor, props.theme) ?? '#6B7280'
      } as CSSProperties
    }
  })
)

const boxStyle = computed<CSSProperties>(() => commonStyle(props.node, props.theme))

const trackStyle = computed<CSSProperties>(() => {
  const color = attr.value.connectorGradient
    ? undefined
    : resolveColor(attr.value.connectorColor, props.theme) ?? '#D1D5DB'
  return {
    backgroundColor: color,
    backgroundImage: attr.value.connectorGradient ?? undefined
  } as CSSProperties
})
</script>
<style scoped lang="less">
.ppt-timeline {
  position: relative;
  display: flex;

  &__track {
    position: absolute;
    background: #d1d5db;
  }

  &--horizontal {
    flex-direction: row;
    align-items: stretch;
    gap: 8px;

    .ppt-timeline__track {
      left: 3%;
      right: 3%;
      top: 46px;
      height: 2px;
    }
  }

  &--vertical {
    flex-direction: column;
    gap: 14px;

    .ppt-timeline__track {
      top: 10px;
      bottom: 10px;
      left: 59px;
      width: 2px;
    }
  }

  &__item {
    position: relative;
    flex: 1;
    min-width: 0;
    display: flex;
  }

  &--horizontal &__item {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  &--vertical &__item {
    flex-direction: row;
    align-items: flex-start;
    gap: 0;
  }

  &__date {
    font-size: 13px;
    font-weight: 600;
  }

  &__dot {
    flex-shrink: 0;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid #fff;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15);
  }

  &--horizontal &__dot {
    margin: 8px 0;
  }

  &--vertical &__date {
    width: 44px;
    text-align: right;
    padding-right: 12px;
    line-height: 1.2;
  }

  &--vertical &__dot {
    margin-top: 3px;
  }

  &__title {
    margin-top: 2px;
  }

  &--vertical &__title {
    margin-top: 0;
    padding-left: 14px;
  }

  &--vertical &__desc {
    padding-left: 14px;
  }
}
</style>
