<template>
  <div class="seq-editor">
    <div v-if="!actions.length" class="seq-editor__empty">{{ emptyText ?? '未绑定 · 添加动作组成执行序列' }}</div>

    <div v-for="(action, index) in actions" :key="index" class="seq-item">
      <div
        class="seq-item__row"
        :class="{ 'seq-item__row--active': expanded === index }"
        @click="toggle(index)"
      >
        <span class="seq-item__index">{{ index + 1 }}</span>
        <component :is="KEYPAD_ACTION_ICONS[action.type]" class="seq-item__icon" />
        <span class="seq-item__text">{{ keypadActionSummary(action) }}</span>
        <span class="seq-item__ops" @click.stop>
          <t-button
            variant="text"
            shape="square"
            size="small"
            :disabled="index === 0"
            @click="move(index, -1)"
          >
            <arrow-up-icon />
          </t-button>
          <t-button
            variant="text"
            shape="square"
            size="small"
            :disabled="index === actions.length - 1"
            @click="move(index, 1)"
          >
            <arrow-down-icon />
          </t-button>
          <t-button variant="text" shape="square" size="small" theme="danger" @click="remove(index)">
            <delete-icon />
          </t-button>
        </span>
      </div>
      <Transition name="seq-fade">
        <div v-if="expanded === index" class="seq-item__editor">
          <component
            :is="KEYPAD_ACTION_EDITORS[action.type]"
            :key="action.type"
            :action="action"
            @change="replace(index, $event)"
          />
        </div>
      </Transition>
    </div>

    <t-button v-if="!adding" variant="dashed" block size="small" @click="adding = true">
      <template #icon>
        <add-icon />
      </template>
      添加动作
    </t-button>
    <div v-else class="seq-editor__types">
      <button
        v-for="definition in KEYPAD_ACTIONS"
        :key="definition.type"
        type="button"
        class="type-card"
        @click="add(definition.type)"
      >
        <component :is="KEYPAD_ACTION_ICONS[definition.type]" class="type-card__icon" />
        <span>{{ definition.label }}</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { KeypadAction } from '@common/types/keypad'
import { KEYPAD_ACTIONS } from '@common/keypad/actions'
import { ArrowDownIcon, ArrowUpIcon, DeleteIcon } from 'tdesign-icons-vue-next'
import { KEYPAD_ACTION_EDITORS, KEYPAD_ACTION_ICONS } from './actionEditors'
import { keypadActionSummary } from './actionText'

defineOptions({ name: 'KeypadSequenceEditor' })

/** 动作序列草稿（只读），变更经 emit('change') 回传，草稿由 KeypadBindingPanel 持有 */
const props = defineProps<{ actions: KeypadAction[]; emptyText?: string }>()
const emit = defineEmits<{ change: [actions: KeypadAction[]] }>()

/** 展开编辑的动作下标（手风琴单开；null = 全部收起） */
const expanded = ref<number | null>(null)
const adding = ref(false)

function toggle(index: number): void {
  expanded.value = expanded.value === index ? null : index
}

/** 相邻交换调序，展开态跟随后移的那一项 */
function move(index: number, offset: -1 | 1): void {
  const target = index + offset
  if (target < 0 || target >= props.actions.length) return
  const next = [...props.actions]
  ;[next[index], next[target]] = [next[target], next[index]]
  expanded.value = target
  emit('change', next)
}

function remove(index: number): void {
  emit(
    'change',
    props.actions.filter((_, i) => i !== index)
  )
  if (expanded.value === index) expanded.value = null
  else if (expanded.value != null && expanded.value > index) expanded.value -= 1
}

function replace(index: number, action: KeypadAction): void {
  emit(
    'change',
    props.actions.map((item, i) => (i === index ? action : item))
  )
}

/** 从注册表建空白草稿追加到序列尾部并展开（空白值不合法，保存按钮由预校验禁用） */
function add(type: KeypadAction['type']): void {
  const action = KEYPAD_ACTIONS.find((definition) => definition.type === type)?.createDefault()
  if (!action) return
  adding.value = false
  expanded.value = props.actions.length
  emit('change', [...props.actions, action])
}
</script>

<style scoped lang="less">
.seq-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__empty {
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
    text-align: center;
    padding: 12px 0;
  }

  /* 添加动作：类型图标选择卡片（Fluent 选择卡片，悬停态品牌色）；五种动作 2 列排布 */
  &__types {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }
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

  &__icon {
    font-size: 20px;
  }
}

.seq-item {
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-secondarycontainer);

  &__row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 4px 6px 8px;
    cursor: pointer;
    border-radius: var(--td-radius-medium);
    transition: background-color 0.12s ease;

    &:hover {
      background: var(--td-bg-color-container);
    }

    &--active,
    &--active:hover {
      background: var(--td-brand-color-1);
    }
  }

  &__index {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    border-radius: var(--td-radius-full);
    background: var(--td-brand-color-2);
    font: var(--td-font-body-small);
    color: var(--td-brand-color-8);
  }

  &__icon {
    font-size: 16px;
    flex-shrink: 0;
    color: var(--td-text-color-secondary);
  }

  &__text {
    flex: 1;
    min-width: 0;
    font: var(--td-font-body-small);
    color: var(--td-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__ops {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  &__editor {
    padding: 8px 10px 10px;
    border-top: 1px solid var(--td-component-stroke);
  }
}

/* 编辑器展开/收起动效 */
.seq-fade-enter-active,
.seq-fade-leave-active {
  transition: opacity 0.12s ease;
}

.seq-fade-enter-from,
.seq-fade-leave-to {
  opacity: 0;
}
</style>
