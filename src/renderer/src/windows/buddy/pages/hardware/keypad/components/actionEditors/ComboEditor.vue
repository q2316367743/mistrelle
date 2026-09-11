<template>
  <div class="combo-editor">
    <button
      type="button"
      class="combo-editor__record"
      :class="{ 'combo-editor__record--recording': recording }"
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

    <div class="combo-editor__media">
      <span class="combo-editor__media-label">功能键</span>
      <t-select
        :value="mediaKey"
        :options="KeypadMediaKeyOptions"
        size="small"
        clearable
        placeholder="音量 / 亮度 / 播放键（不可录制）"
        @change="onMediaChange"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { KeypadAction, KeypadComboAction } from '@common/types/keypad'
import {
  isKeypadMediaKeyName,
  KeypadMediaKeyOptions,
  type KeypadMediaKeyName
} from '@common/types/keypad'
import { startComboRecording, stopComboRecording } from './comboRecorder'
import { comboKeyTokens } from '../actionText'

defineOptions({ name: 'KeypadComboEditor' })

const props = defineProps<{ action: KeypadAction }>()
const emit = defineEmits<{ change: [action: KeypadAction] }>()

/** 本编辑器只服务 combo 动作（父级按注册表分发，运行时恒为 combo） */
const model = computed(
  (): KeypadComboAction | null => (props.action.type === 'combo' ? props.action : null)
)

/** 组合键拆成键帽 token（修饰键 + 主键各自一块；媒体键是单块） */
const keyTokens = computed(() => {
  const next = model.value
  if (!next) return []
  return comboKeyTokens(next.modifiers, next.key)
})

/** 当前选中的媒体键（普通键组合时为 undefined，下拉显示占位） */
const mediaKey = computed((): KeypadMediaKeyName | undefined => {
  const next = model.value
  return next && isKeypadMediaKeyName(next.key) ? next.key : undefined
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

/** 选媒体键：媒体键无修饰语义，修饰键一并清空；清空 = 回到 F13 占位（等待录制或重选） */
function onMediaChange(value: unknown): void {
  if (!model.value) return
  if (typeof value === 'string' && isKeypadMediaKeyName(value)) {
    emit('change', { type: 'combo', modifiers: [], key: value })
    return
  }
  emit('change', { type: 'combo', modifiers: [], key: 'f13' })
}

onUnmounted(() => {
  if (recording.value) stopComboRecording()
})
</script>

<style scoped lang="less">
.combo-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__media {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__media-label {
    flex-shrink: 0;
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
  }

  &__record {
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
