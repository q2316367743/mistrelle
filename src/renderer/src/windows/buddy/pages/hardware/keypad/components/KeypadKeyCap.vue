<template>
  <div
    class="keycap"
    :class="{ 'keycap--down': down, 'keycap--pressed': isPressed }"
    @mousedown="mouseDown = true"
    @mouseup="mouseDown = false"
    @mouseleave="mouseDown = false"
    @click="emit('select')"
  >
    <span class="keycap__badge">{{ keyId }}</span>
    <div class="keycap__summary">
      <template v-if="action?.type === 'app'">
        <img
          v-if="!iconFailed"
          class="keycap__icon"
          :src="appIconHref(action.path)"
          alt=""
          @error="iconFailed = true"
        />
        <span class="keycap__text">{{ appDisplayName(action.path) }}</span>
      </template>
      <span v-else-if="action?.type === 'combo'" class="keycap__text">
        {{ comboSummaryText(action.modifiers, action.key) }}
      </span>
      <span v-else-if="action?.type === 'script'" class="keycap__text">{{ action.command }}</span>
      <span v-else-if="action?.type === 'permission'" class="keycap__text">
        {{ action.decision === 'allow' ? '允许审批' : '拒绝审批' }}
      </span>
      <span v-else class="keycap__text keycap__text--muted">未绑定</span>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { KeypadAction } from '@common/types/keypad'
import { appDisplayName, appIconHref } from './iconHref'
import { comboSummaryText } from './actionText'
import { useKeypad } from '../useKeypad'

defineOptions({ name: 'KeypadKeyCap' })

const props = defineProps<{
  keyId: string
  /** 当前绑定动作（未绑定为 null） */
  action: KeypadAction | null
}>()

const emit = defineEmits<{ select: [] }>()

const { pressed } = useKeypad()

/** 设备物理按下（main 推送；键帽保持按下态并发光） */
const isPressed = computed(() => pressed.value.includes(props.keyId))

/** 鼠标按下的瞬时动画态 */
const mouseDown = ref(false)
const down = computed(() => mouseDown.value || isPressed.value)

/** 图标加载失败（未缓存且提取失败）→ 只显示名称 */
const iconFailed = ref(false)
watch(
  () => (props.action?.type === 'app' ? props.action.path : ''),
  () => {
    iconFailed.value = false
  }
)
</script>

<style scoped lang="less">
/* 拟物键帽：白色键帽面 + 灰色阴影/厚度层（半透明黑随主题自适应），尺寸由键槽决定不设 min-height */
.keycap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 100%;
  padding: 10px 12px;
  box-sizing: border-box;
  cursor: pointer;
  user-select: none;
  border: 1px solid rgba(0, 0, 0, 12%);
  border-radius: var(--td-radius-large);
  background: var(--td-bg-color-container);
  box-shadow:
    0 4px 0 0 rgba(0, 0, 0, 22%),
    0 8px 12px 0 rgba(0, 0, 0, 14%),
    inset 0 1px 0 0 rgba(255, 255, 255, 60%);
  transition:
    transform 0.08s ease,
    box-shadow 0.08s ease,
    border-color 0.08s ease;

  &--down {
    transform: translateY(3px);
    box-shadow:
      0 1px 0 0 rgba(0, 0, 0, 22%),
      0 2px 4px 0 rgba(0, 0, 0, 14%),
      inset 0 1px 0 0 rgba(255, 255, 255, 40%);
  }

  &--pressed {
    border-color: var(--td-brand-color);
    box-shadow:
      0 1px 0 0 rgba(0, 0, 0, 22%),
      0 0 10px 0 var(--td-brand-color),
      inset 0 1px 0 0 rgba(255, 255, 255, 40%);
  }

  &__badge {
    font: var(--td-font-title-medium);
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  &__summary {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    max-width: 100%;
  }

  &__icon {
    width: 18px;
    height: 18px;
    object-fit: contain;
    flex-shrink: 0;
  }

  &__text {
    font: var(--td-font-body-small);
    color: var(--td-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &--muted {
      color: var(--td-text-color-placeholder);
    }
  }
}
</style>
