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
import type { KeypadKnobCell } from './keypadLayouts'
import { useKeypad } from '../useKeypad'

defineOptions({ name: 'KeypadKnob' })

const props = defineProps<{
  cell: KeypadKnobCell
  /** 配置面板打开中（选中高亮） */
  selected?: boolean
}>()

const emit = defineEmits<{ select: [] }>()

const { pressed } = useKeypad()

/** 三路按下态（设备物理上报；含未绑定的键位号） */
const ccwActive = computed(() => pressed.value.includes(props.cell.ccwKey))
const cwActive = computed(() => pressed.value.includes(props.cell.cwKey))
/** 按压通道存在时才参与整体高亮（不可按压的旋钮没有这一路） */
const pressActive = computed(
  () => props.cell.pressKey != null && pressed.value.includes(props.cell.pressKey)
)

/** 鼠标按下的瞬时动画态 */
const mouseDown = ref(false)
const down = computed(() => mouseDown.value || pressActive.value)

/**
 * 键位号提示：直接列出该旋钮占用的键位号（左转/右转/按下）。
 * 同时充当能力指示——不可按压的旋钮少一个号，布局配置在界面上可见。
 */
const hint = computed(() => {
  const ids = [props.cell.ccwKey, props.cell.cwKey]
  if (props.cell.pressKey != null) ids.push(props.cell.pressKey)
  return ids.join('/')
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
