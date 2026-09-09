<template>
  <div class="binding-panel">
    <div class="binding-panel__head">
      <div class="binding-panel__cap">{{ keyId }}</div>
      <div class="binding-panel__title">
        <div class="binding-panel__name">配置键位 {{ keyId }}</div>
        <div
          class="binding-panel__desc"
          :class="{ 'binding-panel__desc--muted': !draft.actions.length }"
        >
          {{ summaryText }}
        </div>
      </div>
      <t-button
        variant="text"
        shape="square"
        size="small"
        class="binding-panel__close"
        @click="emit('close')"
      >
        <close-icon />
      </t-button>
    </div>

    <t-input
      v-model="draft.name"
      size="small"
      clearable
      maxlength="20"
      placeholder="显示名称（可选），留空显示动作摘要"
    />

    <keypad-sequence-editor :actions="draft.actions" @change="draft.actions = $event" />

    <div class="binding-panel__actions">
      <t-button variant="text" theme="danger" size="small" :disabled="saving" @click="clear">
        清除
      </t-button>
      <t-button theme="primary" size="small" :disabled="!valid || saving" @click="save">
        保存
      </t-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { KeypadAction, KeypadBinding } from '@common/types/keypad'
import { keypadActionDefinition } from '@common/keypad/actions'
import { CloseIcon } from 'tdesign-icons-vue-next'
import KeypadSequenceEditor from './KeypadSequenceEditor.vue'
import { keypadActionSummary } from './actionText'
import { useKeypad } from '../useKeypad'

defineOptions({ name: 'KeypadBindingPanel' })

const props = defineProps<{ keyId: string }>()

const emit = defineEmits<{ close: [] }>()

const { config, bindKey } = useKeypad()

/** 绑定草稿（本地编辑态；main 配置回读后同步），name 空串 = 未命名、actions 空 = 未绑定仅状态点亮 */
const draft = ref<{ name: string; actions: KeypadAction[] }>({ name: '', actions: [] })
const saving = ref(false)

// 配置回读（保存成功/清除/外部变更）即同步草稿；编辑中的本地值只在本面板保存时写回
watch(
  () => config.value?.bindings[props.keyId],
  (next) => {
    draft.value = { name: next?.name ?? '', actions: cloneActions(next?.actions ?? []) }
  },
  { immediate: true }
)

function cloneActions(actions: KeypadAction[]): KeypadAction[] {
  const cloned: KeypadAction[] = JSON.parse(JSON.stringify(actions))
  return cloned
}

/** 副标题摘要：动作序列一览（草稿编辑中实时跟随；名称在输入框内可见，不重复展示） */
const summaryText = computed(() => {
  if (!draft.value.actions.length) return '未绑定 · 按键仅点亮状态'
  return draft.value.actions.map(keypadActionSummary).join(' → ')
})

/** 保存预校验：逐条查动作注册表 normalize 清洗，任一不合法（如未选应用/空命令）禁用保存 */
const valid = computed(() => {
  if (!draft.value.actions.length) return false
  return draft.value.actions.every((action) => {
    const raw: Record<string, unknown> = JSON.parse(JSON.stringify(action))
    return keypadActionDefinition(action.type)?.normalize(raw) != null
  })
})

async function save(): Promise<void> {
  if (!draft.value.actions.length || !valid.value) return
  saving.value = true
  try {
    const name = draft.value.name.trim()
    const binding: KeypadBinding = name
      ? { name, actions: draft.value.actions }
      : { actions: draft.value.actions }
    await bindKey(props.keyId, binding)
    emit('close')
  } finally {
    saving.value = false
  }
}

async function clear(): Promise<void> {
  await bindKey(props.keyId, null)
  emit('close')
}
</script>

<style scoped lang="less">
.binding-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;

  /* 标题区：迷你键帽徽标 + 名称 + 当前摘要 + 关闭按钮 */
  &__head {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  &__close {
    margin-left: auto;
  }

  &__cap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: 1px solid rgba(0, 0, 0, 10%);
    border-radius: var(--td-radius-medium);
    background: var(--td-bg-color-secondarycontainer);
    box-shadow: 0 2px 0 0 rgba(0, 0, 0, 12%);
    font: var(--td-font-title-medium);
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  &__name {
    font: var(--td-font-body-medium);
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  &__desc {
    margin-top: 2px;
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &--muted {
      color: var(--td-text-color-placeholder);
    }
  }

  &__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  }
}
</style>
