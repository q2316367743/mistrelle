<template>
  <div class="route-select">
    <div class="route-select__label">{{ label }}</div>
    <t-radio-group :value="activeKeyId" variant="default-filled" size="small" @change="onChange">
      <t-radio-button v-for="route in routes" :key="route.keyId" :value="route.keyId">
        {{ route.label }}
      </t-radio-button>
    </t-radio-group>
  </div>
</template>

<script lang="ts" setup>
import type { KeypadKnobRoute } from './keypadLayouts'

defineOptions({ name: 'KeypadRouteSelect' })

/** 旋钮的绑定路（由布局派生：可按压 3 路 / 不可按压 2 路，长度即能力） */
const props = defineProps<{ routes: KeypadKnobRoute[]; activeKeyId: string; label: string }>()

const emit = defineEmits<{ select: [keyId: string] }>()

/** 单选值可能是 string/number/boolean（Switch 值联合类型先例），收窄后再判定是否属于本旋钮的路 */
function onChange(value: unknown): void {
  if (typeof value !== 'string') return
  if (value === props.activeKeyId) return
  if (!props.routes.some((route) => route.keyId === value)) return
  emit('select', value)
}
</script>

<style scoped lang="less">
.route-select {
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
