<template>
  <div class="delay-editor">
    <t-input-number
      class="delay-editor__input"
      :value="model?.ms"
      :min="DELAY_MS_MIN"
      :max="DELAY_MS_MAX"
      :step="100"
      theme="column"
      suffix="ms"
      @change="onMsChange"
    />
    <div class="delay-editor__hint">执行到该步时暂停指定时长，再继续后续动作</div>
  </div>
</template>

<script lang="ts" setup>
import type { KeypadAction, KeypadDelayAction } from '@common/types/keypad'
import { DELAY_MS_MAX, DELAY_MS_MIN } from '@common/keypad/actions/delay'

defineOptions({ name: 'KeypadDelayEditor' })

const props = defineProps<{ action: KeypadAction }>()
const emit = defineEmits<{ change: [action: KeypadAction] }>()

/** 本编辑器只服务 delay 动作（父级按注册表分发，运行时恒为 delay） */
const model = computed(
  (): KeypadDelayAction | null => (props.action.type === 'delay' ? props.action : null)
)

/** 超范围中间值不回写（组件失焦时自行矫正），回写值保证 normalize 必过 */
function onMsChange(value: unknown): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || !model.value) return
  const ms = Math.round(value)
  if (ms < DELAY_MS_MIN || ms > DELAY_MS_MAX) return
  emit('change', { ...model.value, ms })
}
</script>

<style scoped lang="less">
.delay-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__input {
    width: 100%;
  }

  &__hint {
    font: var(--td-font-body-small);
    color: var(--td-text-color-tertiary);
  }
}
</style>
