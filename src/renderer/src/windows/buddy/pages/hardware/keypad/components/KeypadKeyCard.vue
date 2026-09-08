<template>
  <div class="key-card" :class="{ 'key-card--pressed': isPressed }">
    <div class="key-card__head">
      <span class="key-card__badge">{{ keyId }}</span>
      <t-tag v-if="isPressed" theme="success" variant="light" size="small">按下</t-tag>
      <t-tag v-else theme="default" variant="light" size="small">未按下</t-tag>
    </div>
    <div class="key-card__combo">{{ comboText }}</div>
    <div class="key-card__actions">
      <t-button
        v-if="recording"
        variant="outline"
        theme="warning"
        size="small"
        @click="stopRecording"
      >
        按下组合键…（Esc 取消）
      </t-button>
      <t-button v-else variant="outline" size="small" @click="startRecording">录制快捷键</t-button>
      <t-button v-if="binding" variant="text" theme="danger" size="small" @click="unbind">
        清除
      </t-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { KeypadKeyName, KeypadModifier } from '@common/types/keypad'
import { KeypadModifierOptions, isKeypadKeyName } from '@common/types/keypad'
import { useKeypad } from '../useKeypad'

const props = defineProps<{ keyId: string }>()

defineOptions({ name: 'KeypadKeyCard' })

const { config, pressed, bindKey } = useKeypad()

const isPressed = computed(() => pressed.value.includes(props.keyId))

/** 当前绑定（main 配置为准；保存回读后同步） */
const binding = computed(() => config.value?.bindings[props.keyId] ?? null)

/** 绑定摘要（组合键预览，如 Ctrl+Shift+F13） */
const comboText = computed(() => {
  const next = binding.value
  if (!next) return '未绑定：按键仅点亮状态'
  return '模拟：' + [...next.modifiers.map(labelOf), next.key.toUpperCase()].join(' + ')
})

function labelOf(mod: KeypadModifier): string {
  return KeypadModifierOptions.find((opt) => opt.value === mod)?.label ?? mod
}

/** 录制态（全局同时仅一张卡片在录制，新录制顶掉旧录制） */
const recording = ref(false)
let activeCancel: (() => void) | null = null

function startRecording(): void {
  activeCancel?.()
  recording.value = true
  // capture 阶段监听，先于页面其他快捷处理拿到按键
  window.addEventListener('keydown', onRecordKeydown, true)
  window.addEventListener('blur', cancelRecording)
  activeCancel = cancelRecording
}

function stopRecording(): void {
  if (!recording.value) return
  recording.value = false
  window.removeEventListener('keydown', onRecordKeydown, true)
  window.removeEventListener('blur', cancelRecording)
  if (activeCancel === cancelRecording) activeCancel = null
}

function cancelRecording(): void {
  stopRecording()
}

onUnmounted(() => {
  if (recording.value) stopRecording()
})

/** 录制用 keydown：Esc 取消，纯修饰键继续等待，其余按 code 映射主键 + 修饰 flags 即存 */
function onRecordKeydown(e: KeyboardEvent): void {
  e.preventDefault()
  e.stopPropagation()
  if (e.key === 'Escape') {
    stopRecording()
    return
  }
  if (MODIFIER_ONLY_KEYS.includes(e.key)) return
  const key = codeToKeyName(e.code)
  if (!key) return
  stopRecording()
  const modifiers: KeypadModifier[] = []
  if (e.ctrlKey) modifiers.push('ctrl')
  if (e.altKey) modifiers.push('alt')
  if (e.shiftKey) modifiers.push('shift')
  if (e.metaKey) modifiers.push('meta')
  void bindKey(props.keyId, { modifiers, key })
}

const MODIFIER_ONLY_KEYS = ['Control', 'Shift', 'Alt', 'Meta']

/** event.code → 白名单主键名（字母/数字/F 键；其余键不支持，忽略继续等待） */
function codeToKeyName(code: string): KeypadKeyName | null {
  let name = ''
  if (/^Key[A-Z]$/.test(code)) name = code.slice(3).toLowerCase()
  else if (/^Digit[0-9]$/.test(code)) name = code.slice(5)
  else if (/^F([1-9]|1[0-9])$/.test(code)) name = code.toLowerCase()
  else return null
  return isKeypadKeyName(name) ? name : null
}

function unbind(): void {
  void bindKey(props.keyId, null)
}
</script>

<style scoped lang="less">
.key-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-secondarycontainer);
  transition:
    border-color var(--td-anim-transition),
    box-shadow var(--td-anim-transition);

  &--pressed {
    border-color: var(--td-success-color);
    box-shadow: var(--td-shadow-1);
  }

  &__head {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: var(--td-radius-default);
    font: var(--td-font-title-medium);
    font-weight: 600;
    color: var(--td-text-color-anti);
    background: var(--td-brand-color);
  }

  &--pressed &__badge {
    background: var(--td-success-color);
  }

  &__combo {
    font: var(--td-font-body-medium);
    color: var(--td-text-color-primary);
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}
</style>
