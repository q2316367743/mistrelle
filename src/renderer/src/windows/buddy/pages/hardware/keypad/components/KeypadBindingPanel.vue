<template>
  <div class="binding-panel">
    <div class="binding-panel__head">
      <div class="binding-panel__cap">{{ keyId }}</div>
      <div class="binding-panel__title">
        <div class="binding-panel__name">{{ title }}</div>
        <div
          class="binding-panel__desc"
          :title="summaryText"
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

    <!-- 旋钮专用：路切换条（左转/右转/按下，路由布局能力派生）；普通键位不传 routes -->
    <keypad-route-select
      v-if="routes?.length"
      :routes="routes"
      :active-key-id="keyId"
      label="绑定路"
      @select="emit('route', $event)"
    />

    <t-input
      v-model="draft.name"
      size="small"
      clearable
      maxlength="20"
      placeholder="显示名称（可选），留空显示动作摘要"
    />

    <div class="binding-panel__section">
      <div class="binding-panel__label">短按 · 点击触发</div>
      <keypad-sequence-editor :actions="draft.actions" @change="draft.actions = $event" />
    </div>

    <div class="binding-panel__section">
      <div class="binding-panel__label">长按 · 按住 {{ KEYPAD_HOLD_MS }}ms 触发</div>
      <keypad-sequence-editor
        :actions="draft.holdActions"
        empty-text="未配置长按 · 键位按下立即执行短按序列"
        @change="draft.holdActions = $event"
      />
      <hold-behavior-editor
        v-if="draft.holdActions.length"
        :hold-actions="draft.holdActions"
        :repeat-ms="draft.holdRepeatMs"
        @change="draft.holdRepeatMs = $event"
      />
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
import type { KeypadAction, KeypadBinding } from '@common/types/keypad'
import {
  KEYPAD_HOLD_MS,
  KEYPAD_REPEAT_MS_DEFAULT,
  resolveKeypadHoldBehavior
} from '@common/types/keypad'
import { keypadActionDefinition } from '@common/keypad/actions'
import { CloseIcon } from 'tdesign-icons-vue-next'
import HoldBehaviorEditor from './HoldBehaviorEditor.vue'
import KeypadRouteSelect from './KeypadRouteSelect.vue'
import KeypadSequenceEditor from './KeypadSequenceEditor.vue'
import type { KeypadKnobRoute } from './keypadLayouts'
import { keypadActionSummary } from './actionText'
import { useKeypad } from '../useKeypad'

defineOptions({ name: 'KeypadBindingPanel' })

const props = defineProps<{
  keyId: string
  /** 旋钮路列表（仅旋钮传入；长度即布局能力，缺省 = 普通键位不显示切换条） */
  routes?: KeypadKnobRoute[]
}>()

const emit = defineEmits<{ close: []; route: [keyId: string] }>()

const { config, bindKey } = useKeypad()

/** 当前键位在旋钮路里的名称（左转/右转/按下）；非旋钮路回退键位号 */
const routeLabel = computed(
  () => props.routes?.find((route) => route.keyId === props.keyId)?.label ?? ''
)

/** 标题：旋钮路显示「配置旋钮 · 左转」，普通键位显示键位号 */
const title = computed(() =>
  routeLabel.value ? `配置旋钮 · ${routeLabel.value}` : `配置键位 ${props.keyId}`
)

/** 绑定草稿（本地编辑态；main 配置回读后同步），name 空串 = 未命名、actions 空 = 未绑定仅状态点亮、holdActions 空 = 未配置长按 */
const draft = ref<{
  name: string
  actions: KeypadAction[]
  holdActions: KeypadAction[]
  holdRepeatMs: number
}>({
  name: '',
  actions: [],
  holdActions: [],
  holdRepeatMs: KEYPAD_REPEAT_MS_DEFAULT
})
const saving = ref(false)

// 配置回读（保存成功/清除/外部变更）即同步草稿；编辑中的本地值只在本面板保存时写回
watch(
  () => config.value?.bindings[props.keyId],
  (next) => {
    draft.value = {
      name: next?.name ?? '',
      actions: cloneActions(next?.actions ?? []),
      holdActions: cloneActions(next?.holdActions ?? []),
      holdRepeatMs: next?.holdRepeatMs ?? KEYPAD_REPEAT_MS_DEFAULT
    }
  },
  { immediate: true }
)

function cloneActions(actions: KeypadAction[]): KeypadAction[] {
  return JSON.parse(JSON.stringify(actions))
}

/** 长按行为（由队列形状推导，与 main 执行侧共用同一函数，界面只做展示） */
const holdBehaviorLabel = computed(() => {
  const behavior = resolveKeypadHoldBehavior(draft.value.holdActions)
  if (behavior === 'once') return '长按'
  return `长按（${behavior === 'keep' ? '按住' : '循环'}）`
})

/** 副标题摘要：短按序列一览 + 长按序列（配置时追加并标注推导出的行为，草稿编辑中实时跟随） */
const summaryText = computed(() => {
  if (!draft.value.actions.length) return '未绑定 · 按键仅点亮状态'
  const short = draft.value.actions.map(keypadActionSummary).join(' → ')
  if (!draft.value.holdActions.length) return short
  const hold = draft.value.holdActions.map(keypadActionSummary).join(' → ')
  return `${short}｜${holdBehaviorLabel.value}：${hold}`
})

/** 保存预校验：短按与长按逐条查动作注册表 normalize 清洗，任一不合法（如未选应用/空命令）禁用保存 */
const valid = computed(() => {
  if (!draft.value.actions.length) return false
  const check = (actions: KeypadAction[]): boolean =>
    actions.every((action) => {
      const raw: Record<string, unknown> = JSON.parse(JSON.stringify(action))
      return keypadActionDefinition(action.type)?.normalize(raw) != null
    })
  return check(draft.value.actions) && check(draft.value.holdActions)
})

async function save(): Promise<void> {
  if (!draft.value.actions.length || !valid.value) return
  saving.value = true
  try {
    const name = draft.value.name.trim()
    const binding: KeypadBinding = name
      ? { name, actions: draft.value.actions }
      : { actions: draft.value.actions }
    if (draft.value.holdActions.length) {
      binding.holdActions = draft.value.holdActions
      // holdRepeatMs 仅「持续循环」时有意义
      if (resolveKeypadHoldBehavior(draft.value.holdActions) === 'repeat') {
        binding.holdRepeatMs = draft.value.holdRepeatMs
      }
    }
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
    flex-shrink: 0;
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
    width: 250px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &--muted {
      color: var(--td-text-color-placeholder);
    }
  }

  /* 短按/长按编辑区块：小节标题 + 序列编辑器 */
  &__section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__label {
    font: var(--td-font-body-small);
    font-weight: 600;
    color: var(--td-text-color-secondary);
  }

  &__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  }
}
</style>
