<template>
  <div
    class="knob"
    :class="{ 'knob--selected': selected, 'knob--down': down }"
    @mousedown="mouseDown = true"
    @mouseup="mouseDown = false"
    @mouseleave="mouseDown = false"
    @click="emit('select')"
  >
    <div class="knob__dial">
      <div class="knob__cap">
        <chevron-left-icon
          class="knob__arrow knob__arrow--left"
          :class="{ 'knob__arrow--active': ccwActive }"
        />
        <span class="knob__indicator" />
        <chevron-right-icon
          class="knob__arrow knob__arrow--right"
          :class="{ 'knob__arrow--active': cwActive }"
        />
      </div>
    </div>
    <span class="knob__hint">{{ hint }}</span>
  </div>
</template>

<script lang="ts" setup>
import { ChevronLeftIcon, ChevronRightIcon } from 'tdesign-icons-vue-next'
import { keypadControlBindSignals } from '@common/keypad/controls'
import { KeypadControlCapabilityOptions } from '@common/types/keypad'
import type { KeypadControlCell } from './keypadLayouts'
import { useKeypad } from '../useKeypad'

defineOptions({ name: 'KeypadKnob' })

const props = defineProps<{
  cell: KeypadControlCell
  /** 配置面板打开中（选中高亮） */
  selected?: boolean
}>()

const emit = defineEmits<{ select: [] }>()

const { pressed, rotation } = useKeypad()

/** 该控件可绑定的信号集（由 kind + capabilities 派生，与配置面板同一口径） */
const bindSignals = computed(() =>
  keypadControlBindSignals(props.cell.kind, props.cell.capabilities)
)

/** 该控件是否有某个信号处于按下态（按压类持续状态） */
function isPressed(signal: 'on' | 'left' | 'right'): boolean {
  return pressed.value.some(
    (item) => item.controlId === props.cell.controlId && item.signal === signal
  )
}

/** 该控件某方向的最近转动（瞬时高亮；有极旋钮带幅度值） */
function rotationOf(signal: 'left' | 'right') {
  return rotation.value.find(
    (item) => item.controlId === props.cell.controlId && item.signal === signal
  )
}

/** 左右转高亮：按下态与瞬时转动任一命中即亮 */
const ccwActive = computed(() => isPressed('left') || rotationOf('left') != null)
const cwActive = computed(() => isPressed('right') || rotationOf('right') != null)
/** 按压通道存在时才参与整体高亮（不可按压的旋钮没有这一路） */
const pressActive = computed(() => bindSignals.value.includes('on') && isPressed('on'))

/** 鼠标按下的瞬时动画态 */
const mouseDown = ref(false)
const down = computed(() => mouseDown.value || pressActive.value)

/** 最近一次转动的幅度百分比（有极旋钮才有；无则 null） */
const rotationValue = computed(
  () => rotationOf('left')?.value ?? rotationOf('right')?.value ?? null
)

/** 能力展示名（可按压/有极），用于提示行 */
const capabilityLabels = computed(() =>
  (props.cell.capabilities ?? []).map(
    (capability) =>
      KeypadControlCapabilityOptions.find((opt) => opt.value === capability)?.label ?? capability
  )
)

/**
 * 控件提示行：控件号 + 能力标注（可按压/有极），转动时追加幅度。
 * 同时充当能力指示——不可按压的旋钮没有「按下」路，有极旋钮转动带幅度，都在界面上可见。
 */
const hint = computed(() => {
  const base = capabilityLabels.value.length
    ? `${props.cell.controlId}（${capabilityLabels.value.join('/')}）`
    : props.cell.controlId
  return rotationValue.value == null ? base : `${base} ${rotationValue.value}%`
})
</script>

<style scoped lang="less">
/* 旋钮：圆盘 + 中央刻度 + 盘内左右转方向提示；拟物质感与键帽同一套语言 */
.knob {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 100%;
  padding: 8px;
  box-sizing: border-box;
  cursor: pointer;
  user-select: none;
  border-radius: var(--td-radius-large);
  transition: background-color 0.12s ease;

  &__dial {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__cap {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 58px;
    height: 58px;
    flex-shrink: 0;
    border: 1px solid rgba(0, 0, 0, 14%);
    border-radius: var(--td-radius-full);
    background: radial-gradient(
      circle at 50% 30%,
      var(--td-bg-color-container),
      var(--td-bg-color-secondarycontainer)
    );
    box-shadow:
      0 3px 0 0 rgba(0, 0, 0, 22%),
      0 6px 10px 0 rgba(0, 0, 0, 14%),
      inset 0 1px 0 0 rgba(255, 255, 255, 60%);
    transition:
      transform 0.08s ease,
      box-shadow 0.08s ease,
      border-color 0.08s ease;
  }

  /* 中央指示刻度（旋钮位置感）：上端小竖条 */
  &__indicator {
    width: 3px;
    height: 16px;
    border-radius: var(--td-radius-full);
    background: var(--td-text-color-placeholder);
    transform: translateY(-8px);
  }

  /* 左右转方向提示：贴在圆盘内侧边缘（不占横向布局空间） */
  &__arrow {
    position: absolute;
    top: 50%;
    font-size: 13px;
    color: var(--td-text-color-placeholder);
    transform: translateY(-50%);
    transition: color 0.1s ease;

    &--left {
      left: 4px;
    }

    &--right {
      right: 4px;
    }

    &--active {
      color: var(--td-brand-color);
    }
  }

  &__hint {
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
    white-space: nowrap;
  }

  /* 鼠标按下 / 按压通道触发：圆盘下压并压缩厚度 */
  &--down .knob__cap {
    transform: translateY(3px);
    box-shadow:
      0 1px 0 0 rgba(0, 0, 0, 22%),
      0 2px 4px 0 rgba(0, 0, 0, 14%),
      inset 0 1px 0 0 rgba(255, 255, 255, 40%);
  }

  /* 配置面板选中：brand 描边 + 外圈 ring（与键帽选中态一致） */
  &--selected .knob__cap {
    border-color: var(--td-brand-color);
    box-shadow:
      0 3px 0 0 rgba(0, 0, 0, 22%),
      0 0 0 2px var(--td-brand-color-3),
      0 6px 10px 0 rgba(0, 0, 0, 14%),
      inset 0 1px 0 0 rgba(255, 255, 255, 60%);
  }
}
</style>
