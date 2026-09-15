<template>
  <div class="binding-panel">
    <div class="binding-panel__head">
      <div class="binding-panel__cap">{{ controlId }}</div>
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

    <!-- 多路控件（旋钮）：路切换条（左转/右转/按下，由布局能力派生）；单路控件不显示 -->
    <keypad-signal-select
      v-if="routes.length > 1"
      :routes="routes"
      :active="signal"
      label="绑定路"
      @select="emit('signal', $event)"
    />

    <t-input
      v-model="draft.name"
      size="small"
      clearable
      maxlength="20"
      placeholder="显示名称（可选），留空显示动作摘要"
    />

    <div class="binding-panel__section">
      <div class="binding-panel__label">
        {{ supportsHold ? `短按 · 点击触发` : `${signalLabel} · 触发` }}
      </div>
      <keypad-sequence-editor :actions="draft.actions" @change="draft.actions = $event" />
    </div>

    <!-- 长按仅按压类信号有：转动是瞬时事件（有极旋钮另带幅度），不做长按判定 -->
    <div v-if="supportsHold" class="binding-panel__section">
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
import type {
  KeypadAction,
  KeypadBinding,
  KeypadBindSignal,
  KeypadControlKind
} from '@common/types/keypad'
import {
  KEYPAD_HOLD_MS,
  KEYPAD_REPEAT_MS_DEFAULT,
  KeypadControlKindOptions,
  keypadSignalLabel,
  keypadSignalSupportsHold,
  resolveKeypadHoldBehavior
} from '@common/types/keypad'
import { keypadActionDefinition } from '@common/keypad/actions'
import { CloseIcon } from 'tdesign-icons-vue-next'
import HoldBehaviorEditor from './HoldBehaviorEditor.vue'
import KeypadSignalSelect from './KeypadSignalSelect.vue'
import KeypadSequenceEditor from './KeypadSequenceEditor.vue'
import type { KeypadBindRoute } from './keypadLayouts'
import { keypadActionSummary } from './actionText'
import { useKeypad } from '../useKeypad'

defineOptions({ name: 'KeypadBindingPanel' })

const props = defineProps<{
  controlId: string
  /** 控件基础类型（按键/旋钮；标题展示用） */
  kind: KeypadControlKind
  /** 当前配置的信号路 */
  signal: KeypadBindSignal
  /** 该控件的可绑定路（由布局 kind + capabilities 派生；长度即能力） */
  routes: KeypadBindRoute[]
}>()

const emit = defineEmits<{ close: []; signal: [signal: KeypadBindSignal] }>()

const { config, bindKey } = useKeypad()

/** 该信号是否支持短按/长按两段（按压类 true、转动类 false） */
const supportsHold = computed(() => keypadSignalSupportsHold(props.signal))

/** 当前信号展示名（左转/右转/按下） */
const signalLabel = computed(() => keypadSignalLabel(props.signal))

/** 控件形态名（按键/旋钮） */
const kindLabel = computed(
  () => KeypadControlKindOptions.find((opt) => opt.value === props.kind)?.label ?? '控件'
)

/** 标题：多路控件显示「配置旋钮 10 · 左转」，单路控件显示「配置按键 1」 */
const title = computed(() =>
  props.routes.length > 1
    ? `配置${kindLabel.value} ${props.controlId} · ${signalLabel.value}`
    : `配置${kindLabel.value} ${props.controlId}`
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

// 配置回读（保存成功/清除/切信号路/外部变更）即同步草稿；编辑中的本地值只在本面板保存时写回
watch(
  () => config.value?.bindings[props.controlId]?.[props.signal],
  (next) => {
    draft.value = {
      name: next?.name ?? '',
      actions: cloneActions(next?.actions ?? []),
      // 转动路无长按概念：即便存量数据残留长按字段也不带入草稿
      holdActions: supportsHold.value ? cloneActions(next?.holdActions ?? []) : [],
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
    // 长按字段仅按压类信号写入（转动路落盘后归一化也会剥除，此处不产生脏数据）
    if (supportsHold.value && draft.value.holdActions.length) {
      binding.holdActions = draft.value.holdActions
      // holdRepeatMs 仅「持续循环」时有意义
      if (resolveKeypadHoldBehavior(draft.value.holdActions) === 'repeat') {
        binding.holdRepeatMs = draft.value.holdRepeatMs
      }
    }
    await bindKey(props.controlId, props.signal, binding)
    emit('close')
  } finally {
    saving.value = false
  }
}

async function clear(): Promise<void> {
  await bindKey(props.controlId, props.signal, null)
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
