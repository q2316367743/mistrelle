<template>
  <div class="zhuque-pie">
    <div class="zhuque-pie__ring" :style="ringStyle">
      <div class="zhuque-pie__hole">
        <template v-if="centerLabel">
          <span class="zhuque-pie__hole-label">AI</span>
          <span class="zhuque-pie__hole-value">{{ display.ai }}%</span>
        </template>
      </div>
    </div>
    <div v-if="legend" class="zhuque-pie__legend">
      <div v-for="row in legendRows" :key="row.label" class="legend-row">
        <span class="legend-dot" :style="{ background: row.color }"></span>
        <span class="legend-label">{{ row.label }}</span>
        <span class="legend-value">{{ row.value }}%</span>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import type { ZhuqueDetectResult } from '@/windows/main/modules/tool/components/article/articleTypes'

/**
 * 朱雀检测结果三色环形饼图：AI=红 / 疑似 AI=黄 / 人工=绿（tdesign 语义色 token）。
 * size 传小值 + legend/centerLabel 关闭可作版本条上的迷你圆环指示。
 */
const props = withDefaults(
  defineProps<{
    result: ZhuqueDetectResult
    /** 环形直径（px） */
    size?: number
    /** 是否显示右侧图例 */
    legend?: boolean
    /** 是否在环心显示 AI 占比 */
    centerLabel?: boolean
  }>(),
  { size: 96, legend: true, centerLabel: true }
)

/** 三段占比色（与图例共用） */
const COLORS = {
  ai: 'var(--td-error-color)',
  suspect: 'var(--td-warning-color)',
  human: 'var(--td-success-color)'
} as const

/** 三占比防御性归一（接口承诺和为 100，此处不信任总和） */
const display = computed(() => {
  const { ai, suspect, human } = props.result
  const sum = ai + suspect + human
  if (sum <= 0) return { ai: 0, suspect: 0, human: 0, sum: 0 }
  return { ai, suspect, human, sum }
})

const ringStyle = computed(() => {
  const { ai, suspect, sum } = display.value
  const base = {
    width: `${props.size}px`,
    height: `${props.size}px`
  }
  if (sum <= 0) return { ...base, background: 'var(--td-bg-color-component-disabled)' }
  const a = (ai / sum) * 100
  const b = a + (suspect / sum) * 100
  return {
    ...base,
    background: `conic-gradient(${COLORS.ai} 0 ${a}%, ${COLORS.suspect} ${a}% ${b}%, ${COLORS.human} ${b}% 100%)`
  }
})

const legendRows = computed(() => [
  { label: 'AI 生成', value: display.value.ai, color: COLORS.ai },
  { label: '疑似 AI', value: display.value.suspect, color: COLORS.suspect },
  { label: '人工创作', value: display.value.human, color: COLORS.human }
])
</script>
<style scoped lang="less">
.zhuque-pie {
  display: flex;
  align-items: center;
  gap: 12px;
}

.zhuque-pie__ring {
  position: relative;
  flex-shrink: 0;
  border-radius: 50%;
}

.zhuque-pie__hole {
  position: absolute;
  inset: 24%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--td-bg-color-container);
  border-radius: 50%;
}

.zhuque-pie__hole-label {
  font-size: var(--td-font-size-body-small);
  color: var(--td-text-color-placeholder);
  line-height: 1.2;
}

.zhuque-pie__hole-value {
  font-size: var(--td-font-size-title-medium);
  font-weight: 600;
  color: var(--td-error-color);
  line-height: 1.2;
}

.zhuque-pie__legend {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.legend-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--td-font-size-body-small);
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-label {
  color: var(--td-text-color-secondary);
}

.legend-value {
  color: var(--td-text-color-primary);
  font-variant-numeric: tabular-nums;
}
</style>
