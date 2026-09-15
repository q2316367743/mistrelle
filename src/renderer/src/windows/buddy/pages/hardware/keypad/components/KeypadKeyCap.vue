<template>
  <div
    class="keycap"
    :class="{ 'keycap--down': down, 'keycap--pressed': isPressed, 'keycap--selected': selected }"
    @mousedown="mouseDown = true"
    @mouseup="mouseDown = false"
    @mouseleave="mouseDown = false"
    @click="emit('select')"
  >
    <span class="keycap__badge">{{ controlId }}</span>
    <div class="keycap__summary">
      <template v-if="binding?.actions.length">
        <!-- 已命名：名称即摘要（名称代表整个序列） -->
        <span v-if="name" class="keycap__text">{{ name }}</span>
        <template v-else>
          <!-- 未命名：首条动作摘要（app 带图标），多动作时小字标注总数 -->
          <div class="keycap__line">
            <img
              v-if="firstAppPath && !failedIcons[firstAppPath]"
              class="keycap__icon"
              :src="appIconHref(firstAppPath)"
              alt=""
              @error="markFailed(firstAppPath)"
            />
            <span v-if="first" class="keycap__text">{{ keypadActionSummary(first) }}</span>
          </div>
          <span v-if="binding.actions.length > 1" class="keycap__more">
            共 {{ binding.actions.length }} 个动作
          </span>
        </template>
      </template>
      <span v-else class="keycap__text keycap__text--muted">未绑定</span>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { KeypadAction, KeypadBinding } from '@common/types/keypad'
import { appIconHref } from './iconHref'
import { keypadActionSummary } from './actionText'
import { useKeypad } from '../useKeypad'

defineOptions({ name: 'KeypadKeyCap' })

const props = defineProps<{
  controlId: string
  /** 当前控件「按下」路的绑定（未绑定为 null） */
  binding: KeypadBinding | null
  /** 配置面板打开中（控件选中高亮） */
  selected?: boolean
}>()

const emit = defineEmits<{ select: [] }>()

const { pressed } = useKeypad()

/** 设备物理按下（main 推送；键帽保持按下态并发光） */
const isPressed = computed(() =>
  pressed.value.some((item) => item.controlId === props.controlId && item.signal === 'on')
)

/** 鼠标按下的瞬时动画态 */
const mouseDown = ref(false)
const down = computed(() => mouseDown.value || isPressed.value)

/** 显示名称（trim 非空才生效） */
const name = computed(() => props.binding?.name?.trim() ?? '')

/** 首条动作（未命名回退显示；binding.actions 恒非空，守卫仅类型收窄） */
const first = computed<KeypadAction | null>(() => props.binding?.actions[0] ?? null)

/** 首条为 app 动作时的图标路径（其他类型/空绑定 = null） */
const firstAppPath = computed(() => {
  const action = props.binding?.actions[0]
  return action?.type === 'app' ? action.path : null
})

/** 图标加载失败（未缓存且提取失败）→ 该行只显示文本 */
const failedIcons = reactive<Record<string, boolean>>({})

function markFailed(path: string): void {
  failedIcons[path] = true
}
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
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    max-width: 100%;
    /* 序列过长时纵向截断（键帽高度有限） */
    overflow: hidden;
  }

  &__line {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
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

  /* 未命名多动作：总数小字标注 */
  &__more {
    font: var(--td-font-body-small);
    color: var(--td-text-color-tertiary);
    white-space: nowrap;
  }

  /* 配置面板选中：brand 描边 + 外圈 ring（定义在按下态之后，叠加物理按下发光仍可辨识） */
  &--selected {
    border-color: var(--td-brand-color);
    box-shadow:
      0 4px 0 0 rgba(0, 0, 0, 22%),
      0 0 0 2px var(--td-brand-color-3),
      0 8px 12px 0 rgba(0, 0, 0, 14%),
      inset 0 1px 0 0 rgba(255, 255, 255, 60%);
  }
}
</style>
