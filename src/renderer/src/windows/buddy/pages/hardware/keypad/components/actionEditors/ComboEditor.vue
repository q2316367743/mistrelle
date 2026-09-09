<template>
  <button
    type="button"
    class="combo-editor"
    :class="{ 'combo-editor--recording': recording }"
    @click="toggleRecording"
  >
    <template v-if="recording">
      <span class="combo-editor__hint">按下组合键…</span>
      <span class="combo-editor__sub">Esc 取消</span>
    </template>
    <template v-else-if="model">
      <span class="combo-editor__keys">
        <template v-for="(token, index) in keyTokens" :key="token">
          <span v-if="index > 0" class="combo-editor__plus">+</span>
          <kbd class="combo-editor__kbd">{{ token }}</kbd>
        </template>
      </span>
      <span class="combo-editor__sub">点击重新录制</span>
    </template>
    <template v-else>
      <span class="combo-editor__hint">点击录制组合键</span>
      <span class="combo-editor__sub">如 Ctrl + Shift + F13</span>
    </template>
  </button>
</template>

<script lang="ts" setup>
import type { KeypadAction, KeypadComboAction } from '@common/types/keypad'
import { startComboRecording, stopComboRecording } from './comboRecorder'
import { comboSummaryText } from '../actionText'

defineOptions({ name: 'KeypadComboEditor' })

const props = defineProps<{ action: KeypadAction }>()
const emit = defineEmits<{ change: [action: KeypadAction] }>()

/** 本编辑器只服务 combo 动作（父级按注册表分发，运行时恒为 combo） */
const model = computed(
  (): KeypadComboAction | null => (props.action.type === 'combo' ? props.action : null)
)

/** 组合键拆成键帽 token（修饰键 + 主键各自一块） */
const keyTokens = computed(() => {
  const next = model.value
  if (!next) return []
  return comboSummaryText(next.modifiers, next.key).split(' + ')
})

const recording = ref(false)

function toggleRecording(): void {
  if (recording.value) {
    stopComboRecording()
    return
  }
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

onUnmounted(() => {
  if (recording.value) stopComboRecording()
})
</script>

<style scoped lang="less">
.combo-editor {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 10px;
  border: 1px dashed var(--td-component-stroke);
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-container);
  cursor: pointer;
  transition: border-color 0.12s ease;

  &:hover {
    border-color: var(--td-brand-color-5);
  }

  &--recording {
    border-style: solid;
    border-color: var(--td-brand-color-6);
    animation: combo-pulse 1.2s ease-in-out infinite;
  }

  &__keys {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 6px;
  }

  &__kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 30px;
    padding: 0 10px;
    border: 1px solid rgba(0, 0, 0, 12%);
    border-radius: var(--td-radius-medium);
    background: var(--td-bg-color-secondarycontainer);
    box-shadow: 0 2px 0 0 rgba(0, 0, 0, 15%);
    font: var(--td-font-body-medium);
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  &__plus {
    font: var(--td-font-body-medium);
    color: var(--td-text-color-placeholder);
  }

  &__hint {
    font: var(--td-font-body-medium);
    color: var(--td-text-color-primary);
  }

  &__sub {
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }
}

@keyframes combo-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(0, 0, 0, 0%);
  }

  50% {
    box-shadow: 0 0 0 4px var(--td-brand-color-2);
  }
}
</style>
