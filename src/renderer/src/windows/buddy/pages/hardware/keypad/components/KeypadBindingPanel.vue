<template>
  <div class="binding-panel">
    <div class="binding-panel__head">
      <div class="binding-panel__cap">{{ keyId }}</div>
      <div class="binding-panel__title">
        <div class="binding-panel__name">配置键位 {{ keyId }}</div>
        <div class="binding-panel__desc" :class="{ 'binding-panel__desc--muted': !draft }">
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

    <div class="binding-panel__types">
      <button
        v-for="definition in KEYPAD_ACTIONS"
        :key="definition.type"
        type="button"
        class="type-card"
        :class="{ 'type-card--active': draft?.type === definition.type }"
        @click="onTypeChange(definition.type)"
      >
        <component :is="KEYPAD_ACTION_ICONS[definition.type]" class="type-card__icon" />
        <span>{{ definition.label }}</span>
      </button>
    </div>

    <div class="binding-panel__editor">
      <Transition name="panel-fade" mode="out-in">
        <component
          :is="editor"
          v-if="draft"
          :key="draft.type"
          :action="draft"
          @change="onDraftChange"
        />
        <div v-else class="binding-panel__empty">选择动作类型后开始配置</div>
      </Transition>
    </div>

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
import type { KeypadAction } from '@common/types/keypad'
import { isKeypadActionType, keypadActionDefinition, KEYPAD_ACTIONS } from '@common/keypad/actions'
import { CloseIcon } from 'tdesign-icons-vue-next'
import { KEYPAD_ACTION_EDITORS, KEYPAD_ACTION_ICONS } from './actionEditors'
import { comboSummaryText } from './actionText'
import { appDisplayName } from './iconHref'
import { useKeypad } from '../useKeypad'

defineOptions({ name: 'KeypadBindingPanel' })

const props = defineProps<{ keyId: string }>()

const emit = defineEmits<{ close: [] }>()

const { config, bindKey } = useKeypad()

/** 绑定草稿（本地编辑态；main 配置回读后同步），null = 未绑定仅状态点亮 */
const draft = ref<KeypadAction | null>(null)
const saving = ref(false)

// 配置回读（保存成功/清除/外部变更）即同步草稿；编辑中的本地值只在本面板保存时写回
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

/** 副标题摘要：当前绑定的内容一览（草稿编辑中实时跟随） */
const summaryText = computed(() => {
  const action = draft.value
  if (!action) return '未绑定 · 按键仅点亮状态'
  if (action.type === 'combo') return comboSummaryText(action.modifiers, action.key)
  if (action.type === 'app') return appDisplayName(action.path) || '未选择应用'
  if (action.type === 'permission')
    return action.decision === 'allow' ? '允许最近待审请求' : '拒绝最近待审请求'
  return action.command.trim() || '未填写命令'
})

/** 切动作类型：查注册表建空白草稿（空白值不合法，保存按钮由预校验禁用） */
function onTypeChange(type: string): void {
  if (!isKeypadActionType(type)) return
  draft.value = keypadActionDefinition(type)?.createDefault() ?? null
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

  /* 动作类型：图标选择卡片（Fluent 选择卡片，选中态品牌色）；四种动作 2×2 排布 */
  &__types {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }

  .type-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px 0 8px;
    border: 1px solid var(--td-component-stroke);
    border-radius: var(--td-radius-medium);
    background: var(--td-bg-color-secondarycontainer);
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
    cursor: pointer;
    transition:
      border-color 0.12s ease,
      background-color 0.12s ease,
      color 0.12s ease;

    &:hover {
      border-color: var(--td-brand-color-5);
      color: var(--td-brand-color-7);
    }

    &--active,
    &--active:hover {
      border-color: var(--td-brand-color-6);
      background: var(--td-brand-color-1);
      color: var(--td-brand-color-8);
    }

    &__icon {
      font-size: 20px;
    }
  }

  /* 编辑区：稳定高度防面板跳动；不再套浅底容器，编辑器控件直接落于面板 */
  &__editor {
    min-height: 104px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  &__empty {
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
    text-align: center;
    padding: 20px 0;
  }

  &__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  }
}

/* 类型/编辑器切换动效 */
.panel-fade-enter-active,
.panel-fade-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}

.panel-fade-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.panel-fade-leave-to {
  opacity: 0;
}
</style>
