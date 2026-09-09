<template>
  <div class="combo-editor">
    <t-button v-if="recording" variant="outline" theme="warning" size="small" @click="cancel">
      按下组合键…（Esc 取消）
    </t-button>
    <t-button v-else variant="outline" size="small" @click="record">录制快捷键</t-button>
    <div class="combo-editor__preview">{{ comboText }}</div>
  </div>
</template>

<script lang="ts" setup>
import type { KeypadAction, KeypadComboAction, KeypadModifier } from '@common/types/keypad'
import { KeypadModifierOptions } from '@common/types/keypad'
import { startComboRecording, stopComboRecording } from './comboRecorder'

defineOptions({ name: 'KeypadComboEditor' })

const props = defineProps<{ action: KeypadAction }>()
const emit = defineEmits<{ change: [action: KeypadAction] }>()

/** 本编辑器只服务 combo 动作（父级按注册表分发，运行时恒为 combo） */
const model = computed(
  (): KeypadComboAction | null => (props.action.type === 'combo' ? props.action : null)
)

/** 组合预览（如 Ctrl + Shift + F13） */
const comboText = computed(() => {
  const next = model.value
  if (!next) return ''
  return [...next.modifiers.map(labelOf), next.key.toUpperCase()].join(' + ')
})

function labelOf(mod: KeypadModifier): string {
  return KeypadModifierOptions.find((opt) => opt.value === mod)?.label ?? mod
}

const recording = ref(false)

function record(): void {
  startComboRecording({
    onSettled: () => {
      recording.value = false
    },
    onPick: (recorded) => {
      if (model.value) emit('change', { ...model.value, ...recorded })
    }
  })
  recording.value = true
}

function cancel(): void {
  stopComboRecording()
}

onUnmounted(() => {
  if (recording.value) cancel()
})
</script>

<style scoped lang="less">
.combo-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__preview {
    font: var(--td-font-body-medium);
    color: var(--td-text-color-primary);
  }
}
</style>
