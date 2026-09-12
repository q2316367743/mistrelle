<template>
  <div class="combo-editor">
    <button
      type="button"
      class="combo-editor__record"
      :class="{ 'combo-editor__record--recording': recording }"
      @click="toggleRecording"
    >
      <template v-if="recording">
        <span class="combo-editor__hint">按下主键…</span>
        <span class="combo-editor__sub">Esc 取消</span>
      </template>
      <template v-else-if="model?.key != null">
        <kbd class="combo-editor__kbd">{{ keyLabel }}</kbd>
        <span class="combo-editor__sub">点击重新录制主键</span>
      </template>
      <template v-else>
        <span class="combo-editor__hint">未设置主键</span>
        <span class="combo-editor__sub">点击录制主键 · Fn 请用下方修饰键</span>
      </template>
    </button>

    <div class="combo-editor__mods">
      <span class="combo-editor__mods-label">修饰键</span>
      <t-checkbox-group
        :value="model?.modifiers ?? []"
        :options="KeypadModifierOptions"
        size="small"
        @change="onModifiersChange"
      />
      <t-button
        v-if="model?.key != null"
        variant="outline"
        size="small"
        :disabled="!model?.modifiers.length"
        @click="onClearKey"
      >
        清除主键
      </t-button>
    </div>

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

    <p v-if="hasFn" class="combo-editor__tip">
      Fn 无法录制（macOS 不为它产生按键事件）：只勾 Fn 并清除主键 = 长按 Fn
    </p>
  </div>
</template>

<script lang="ts" setup>
import type { KeypadAction, KeypadComboAction, KeypadModifier } from '@common/types/keypad'
import {
  isKeypadMediaKeyName,
  isKeypadModifier,
  KeypadMediaKeyOptions,
  KeypadModifierOptions,
  keypadKeyLabel,
  type KeypadMediaKeyName
} from '@common/types/keypad'
import { startComboRecording, stopComboRecording } from './comboRecorder'

defineOptions({ name: 'KeypadComboEditor' })

const props = defineProps<{ action: KeypadAction }>()
const emit = defineEmits<{ change: [action: KeypadAction] }>()

/** 本编辑器只服务 combo 动作（父级按注册表分发，运行时恒为 combo） */
const model = computed((): KeypadComboAction | null =>
  props.action.type === 'combo' ? props.action : null
)

/** 主键展示名（未设置主键时为 null，录制区显示「未设置主键」） */
const keyLabel = computed((): string | null => {
  const key = model.value?.key
  return key == null ? null : keypadKeyLabel(key)
})

/** 是否勾选了 Fn（显示「Fn 无法录制」提示，并引导用清除主键表达长按 Fn） */
const hasFn = computed(() => (model.value?.modifiers ?? []).includes('fn'))

/** 当前选中的媒体键（普通键组合时为 undefined，下拉显示占位） */
const mediaKey = computed((): KeypadMediaKeyName | undefined => {
  const next = model.value
  return next?.key != null && isKeypadMediaKeyName(next.key) ? next.key : undefined
})

const recording = ref(false)

/** 录制主键：只录普通键（媒体键与 Fn 录不到），已勾选的修饰键原样保留 */
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
      const next = model.value
      if (!next) return
      emit('change', { type: 'combo', modifiers: next.modifiers, key: recorded.key })
    }
  })
  recording.value = true
}

/** 勾选修饰键：媒体键无组合语义，勾了修饰键就清掉媒体主键（否则归一化会丢弃修饰键） */
function onModifiersChange(value: unknown): void {
  const next = model.value
  if (!next) return
  const modifiers: KeypadModifier[] = []
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string' && isKeypadModifier(item) && !modifiers.includes(item)) {
        modifiers.push(item)
      }
    }
  }
  const key = next.key
  // 媒体主键与修饰键不能共存：勾了修饰键就退掉媒体主键（主键留空，等重新录制）
  if (key != null && isKeypadMediaKeyName(key)) {
    emit(
      'change',
      modifiers.length ? { type: 'combo', modifiers } : { type: 'combo', modifiers, key }
    )
    return
  }
  // 主键与修饰键皆空 = 未完成动作，保留空态（保存按钮由预校验禁用）
  emit('change', key == null ? { type: 'combo', modifiers } : { type: 'combo', modifiers, key })
}

/** 清除主键 = 只按住修饰键（长按 Fn 场景）；无修饰键时按钮已禁用，空动作不合法故在此兜底 */
function onClearKey(): void {
  const next = model.value
  if (!next || !next.modifiers.length) return
  emit('change', { type: 'combo', modifiers: next.modifiers })
}

/** 选媒体键：媒体键无修饰语义，修饰键一并清空；清空下拉 = 回到未设主键（等录制或重选） */
function onMediaChange(value: unknown): void {
  if (!model.value) return
  if (typeof value === 'string' && isKeypadMediaKeyName(value)) {
    emit('change', { type: 'combo', modifiers: [], key: value })
    return
  }
  emit('change', { type: 'combo', modifiers: [] })
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

  &__mods {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__mods-label {
    flex-shrink: 0;
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
  }

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

  &__tip {
    margin: 0;
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
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
