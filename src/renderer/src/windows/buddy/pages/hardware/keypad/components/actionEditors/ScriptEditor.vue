<template>
  <t-textarea
    :value="model?.command ?? ''"
    :autosize="{ minRows: 2, maxRows: 5 }"
    placeholder="任意 shell 命令，如 ~/scripts/demo.sh"
    @change="onCommandChange"
  />
</template>

<script lang="ts" setup>
import type { KeypadAction, KeypadScriptAction } from '@common/types/keypad'

defineOptions({ name: 'KeypadScriptEditor' })

const props = defineProps<{ action: KeypadAction }>()
const emit = defineEmits<{ change: [action: KeypadAction] }>()

/** 本编辑器只服务 script 动作（父级按注册表分发，运行时恒为 script） */
const model = computed(
  (): KeypadScriptAction | null => (props.action.type === 'script' ? props.action : null)
)

function onCommandChange(value: unknown): void {
  const command = typeof value === 'string' ? value : ''
  if (model.value) emit('change', { ...model.value, command })
}
</script>
