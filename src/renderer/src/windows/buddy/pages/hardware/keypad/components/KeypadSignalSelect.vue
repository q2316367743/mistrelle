<template>
  <div class="signal-select">
    <div class="signal-select__label">{{ label }}</div>
    <t-radio-group :value="active" variant="default-filled" size="small" @change="onChange">
      <t-radio-button v-for="route in routes" :key="route.signal" :value="route.signal">
        {{ route.label }}
      </t-radio-button>
    </t-radio-group>
  </div>
</template>

<script lang="ts" setup>
import type { KeypadBindSignal } from '@common/types/keypad'
import type { KeypadBindRoute } from './keypadLayouts'

defineOptions({ name: 'KeypadSignalSelect' })

/** 控件的可绑定路（由布局的 kind + capabilities 派生：按键 1 路 / 旋钮 2–3 路，长度即能力） */
const props = defineProps<{ routes: KeypadBindRoute[]; active: KeypadBindSignal; label: string }>()

const emit = defineEmits<{ select: [signal: KeypadBindSignal] }>()

/** 单选值可能是 string/number/boolean（Switch 值联合类型先例），收窄后再判定是否属于本控件的路 */
function onChange(value: unknown): void {
  if (typeof value !== 'string') return
  if (value === props.active) return
  if (!props.routes.some((route) => route.signal === value)) return
  emit('select', value as KeypadBindSignal)
}
</script>

<style scoped lang="less">
.signal-select {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &__label {
    font: var(--td-font-body-small);
    font-weight: 600;
    color: var(--td-text-color-secondary);
  }
}
</style>
