<template>
  <div class="hold-behavior">
    <div class="hold-behavior__row">
      <span class="hold-behavior__title">{{ behaviorLabel }}</span>
      <template v-if="behavior === 'repeat'">
        <span class="hold-behavior__row-label">循环间隔</span>
        <t-input-number
          :value="repeatMs"
          :min="KEYPAD_REPEAT_MS_MIN"
          :max="KEYPAD_REPEAT_MS_MAX"
          :step="10"
          suffix="ms"
          @change="onRepeatChange"
        />
      </template>
    </div>
    <div class="hold-behavior__hint">{{ hint }}</div>
  </div>
</template>

<script lang="ts" setup>
import {
  KeypadHoldBehaviorOptions,
  KEYPAD_HOLD_MS,
  KEYPAD_REPEAT_MS_MAX,
  KEYPAD_REPEAT_MS_MIN,
  resolveKeypadHoldBehavior,
  type KeypadAction,
  type KeypadHoldBehavior
} from '@common/types/keypad'

defineOptions({ name: 'KeypadHoldBehaviorEditor' })

const props = defineProps<{
  /** 长按动作队列（行为由它的形状推导，本组件只读不改队列） */
  holdActions: KeypadAction[]
  /** 循环每轮间隔 ms（仅「持续循环」时有意义） */
  repeatMs: number
}>()

const emit = defineEmits<{ change: [repeatMs: number] }>()

/** 行为由长按队列形状推导（判定收口在 @common，与 main 执行侧共用同一函数） */
const behavior = computed(() => resolveKeypadHoldBehavior(props.holdActions))

const behaviorLabel = computed(
  () => KeypadHoldBehaviorOptions.find((opt) => opt.value === behavior.value)?.label ?? '执行一次'
)

/** 各行为语义提示（循环会逐轮重跑全部动作，保持只作用于模拟按键，均需显式说明） */
const HINTS: Record<KeypadHoldBehavior, string> = {
  once: `单条动作 · 按住达到 ${KEYPAD_HOLD_MS}ms 后执行一次`,
  keep: `单条模拟按键 · 按住达到 ${KEYPAD_HOLD_MS}ms 后持续按住，松手才抬起`,
  repeat: `多条动作 · 按住达到 ${KEYPAD_HOLD_MS}ms 后反复执行整个队列，松手停止；队列里每个动作都会逐轮重跑`
}

const hint = computed(() => HINTS[behavior.value])

/** 超范围中间值不回写（组件失焦时自行矫正），回写值保证 normalize 必过 */
function onRepeatChange(value: unknown): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) return
  const ms = Math.round(value)
  if (ms < KEYPAD_REPEAT_MS_MIN || ms > KEYPAD_REPEAT_MS_MAX) return
  emit('change', ms)
}
</script>

<style scoped lang="less">
.hold-behavior {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-secondarycontainer);

  &__row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__title {
    font: var(--td-font-body-small);
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  &__row-label {
    margin-left: auto;
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
  }

  &__hint {
    font: var(--td-font-body-small);
    color: var(--td-text-color-tertiary);
  }
}
</style>
