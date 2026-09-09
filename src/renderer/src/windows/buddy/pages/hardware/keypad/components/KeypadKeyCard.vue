<template>
  <div class="key-card" :class="{ 'key-card--pressed': isPressed }">
    <div class="key-card__head">
      <span class="key-card__badge">{{ keyId }}</span>
      <t-tag v-if="isPressed" theme="success" variant="light" size="small">按下</t-tag>
      <t-tag v-else theme="default" variant="light" size="small">未按下</t-tag>
    </div>
    <t-select
      :value="draft?.type ?? undefined"
      :options="KeypadActionTypeOptions"
      placeholder="未绑定：选择动作类型"
      size="small"
      @change="onTypeChange"
    />
    <component :is="editor" v-if="draft" :action="draft" @change="onDraftChange" />
    <div v-if="draft" class="key-card__actions">
      <t-button size="small" :disabled="!valid || saving" @click="save">保存</t-button>
      <t-button variant="text" theme="danger" size="small" :disabled="saving" @click="clear">
        清除
      </t-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { KeypadAction } from '@common/types/keypad'
import {
  isKeypadActionType,
  keypadActionDefinition,
  KeypadActionTypeOptions
} from '@common/keypad/actions'
import { KEYPAD_ACTION_EDITORS } from './actionEditors'
import { useKeypad } from '../useKeypad'

const props = defineProps<{ keyId: string }>()

defineOptions({ name: 'KeypadKeyCard' })

const { config, pressed, bindKey } = useKeypad()

const isPressed = computed(() => pressed.value.includes(props.keyId))

/** 绑定草稿（本地编辑态；main 配置回读后同步），null = 未绑定仅状态点亮 */
const draft = ref<KeypadAction | null>(null)
const saving = ref(false)

// 配置回读（保存成功/清除/外部变更）即同步草稿；编辑中的本地值只在本卡片保存时写回
watch(
  () => config.value?.bindings[props.keyId],
  (next) => {
    draft.value = cloneAction(next ?? null)
  },
  { immediate: true }
)

function cloneAction(action: KeypadAction | null): KeypadAction | null {
  if (!action) return null
  const cloned: KeypadAction = JSON.parse(JSON.stringify(action))
  return cloned
}

/** 切动作类型：查注册表建空白草稿（空白值不合法，保存按钮由预校验禁用） */
function onTypeChange(value: unknown): void {
  if (typeof value !== 'string' || !isKeypadActionType(value)) return
  draft.value = keypadActionDefinition(value)?.createDefault() ?? null
}

function onDraftChange(action: KeypadAction): void {
  draft.value = action
}

const editor = computed(() => (draft.value ? KEYPAD_ACTION_EDITORS[draft.value.type] : null))

/** 保存预校验：查动作注册表 normalize 清洗，不合法（如未选应用/空命令）禁用保存 */
const valid = computed(() => {
  if (!draft.value) return false
  const raw: Record<string, unknown> = JSON.parse(JSON.stringify(draft.value))
  return keypadActionDefinition(draft.value.type)?.normalize(raw) != null
})

async function save(): Promise<void> {
  if (!draft.value || !valid.value) return
  saving.value = true
  try {
    await bindKey(props.keyId, draft.value)
  } finally {
    saving.value = false
  }
}

async function clear(): Promise<void> {
  await bindKey(props.keyId, null)
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

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}
</style>
