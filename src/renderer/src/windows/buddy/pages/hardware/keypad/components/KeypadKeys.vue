<template>
  <div class="panel">
    <div class="panel-head">
      <div class="panel-title">按键绑定</div>
      <t-select
        :value="config?.layout"
        :options="layoutOptions"
        size="small"
        class="panel-head__layout"
        @change="onLayoutChange"
      />
    </div>
    <div class="panel-body">
      <div class="keyboard-area">
        <div class="keyboard">
          <template v-for="(group, index) in layout.groups" :key="index">
            <!-- 组间视觉分隔（不可点击），仅分隔不参与格位 -->
            <t-divider v-if="index > 0" layout="vertical" class="keyboard__divider" />
            <div
              class="keyboard__group"
              :style="{ gridTemplateColumns: `repeat(${group.columns}, var(--key-size))` }"
            >
              <div
                v-for="cell in group.cells"
                :key="cellKey(cell)"
                class="key-slot"
                :style="spanStyle(cell)"
              >
                <keypad-knob
                  v-if="cell.kind === 'knob'"
                  :cell="cell"
                  :selected="isCellSelected(selection, cell.controlId)"
                  @select="selectControl(cell)"
                />
                <keypad-key-cap
                  v-else
                  :control-id="cell.controlId"
                  :binding="
                    bindingAt(config?.bindings, { controlId: cell.controlId, signal: 'on' })
                  "
                  :selected="
                    isSameSelection(selection, { controlId: cell.controlId, signal: 'on' })
                  "
                  @select="selectSignal(cell.controlId, 'on')"
                />
              </div>
            </div>
          </template>
        </div>
      </div>
      <aside class="side-panel">
        <Transition name="panel-fade" mode="out-in">
          <keypad-binding-panel
            v-if="selection"
            :key="`${selection.controlId}:${selection.signal}`"
            :control-id="selection.controlId"
            :kind="activeContext.cell?.kind ?? 'button'"
            :signal="selection.signal"
            :routes="activeRoutes"
            @signal="selectSignal(selection.controlId, $event)"
            @close="selection = null"
          />
          <div v-else key="empty" class="side-panel__empty">
            <gesture-click-icon class="side-panel__empty-icon" />
            <span>点击左侧键位，配置按键动作</span>
          </div>
        </Transition>
      </aside>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { KeypadBindSignal } from '@common/types/keypad'
import { isKeypadLayoutId } from '@common/types/keypad'
import { GestureClickIcon } from 'tdesign-icons-vue-next'
import KeypadKeyCap from './KeypadKeyCap.vue'
import KeypadKnob from './KeypadKnob.vue'
import KeypadBindingPanel from './KeypadBindingPanel.vue'
import { applyLayoutPreset } from './layoutPreset'
import {
  KEYPAD_LAYOUTS,
  controlRoutes,
  keypadLayoutOf,
  type KeypadControlCell
} from './keypadLayouts'
import {
  bindingAt,
  flattenCells,
  isCellSelected,
  isSameSelection,
  selectionContext,
  type KeypadSelection
} from './keypadSelection'
import { useKeypad } from '../useKeypad'

defineOptions({ name: 'KeypadKeys' })

const { config, saveLayout, saveBindings } = useKeypad()

/** 当前布局（main 配置持有；未回读时缺省首个） */
const layout = computed(() => keypadLayoutOf(config.value?.layout))

const layoutOptions = KEYPAD_LAYOUTS.map((item) => ({ value: item.id, label: item.label }))

/** 切换样式：落盘布局，并把该样式的预置映射补进未绑定信号路（不覆盖已有绑定） */
async function onLayoutChange(value: unknown): Promise<void> {
  if (typeof value !== 'string' || !isKeypadLayoutId(value)) return
  await saveLayout(value)
  const target = keypadLayoutOf(value)
  const current = config.value?.bindings ?? {}
  const next = applyLayoutPreset(target, current)
  if (next) await saveBindings(next)
  selection.value = null
}

/** cell 的 DOM key：一个控件一个 cell（kind 前缀防同类同名冲突） */
function cellKey(cell: KeypadControlCell): string {
  return `${cell.kind}-${cell.controlId}`
}

/** 大键位跨行/跨列（作用于键槽 grid item 上；旋钮不跨格） */
function spanStyle(cell: KeypadControlCell): Record<string, string> {
  if (cell.kind === 'knob') return {}
  return {
    gridColumn: `span ${cell.cols ?? 1}`,
    gridRow: `span ${cell.rows ?? 1}`
  }
}

/** 配置面板打开中的目标（控件 + 信号路）；点其他路切换、再点同路关闭 */
const selection = ref<KeypadSelection | null>(null)

/** 布局内全部 cell 的拍平索引（选中目标按 controlId 反查所属 cell） */
const cells = computed(() => flattenCells(layout.value.groups))

/** 选中目标所属 cell 与其可绑定路（面板据此渲染信号切换条） */
const activeContext = computed(() => selectionContext(cells.value, selection.value))
const activeRoutes = computed(() => activeContext.value.routes)

/** 选中某控件的某一路信号；已选中该路则关闭面板（toggle） */
function selectSignal(controlId: string, signal: KeypadBindSignal): void {
  const target: KeypadSelection = { controlId, signal }
  selection.value = isSameSelection(selection.value, target) ? null : target
}

/** 点旋钮：落到该控件的首条可绑定路（左转，若不可转动则为首路）；再点当前路则关闭 */
function selectControl(cell: KeypadControlCell): void {
  const first = controlRoutes(cell)[0]
  if (!first) return
  selectSignal(cell.controlId, first.signal)
}
</script>

<style scoped lang="less">
.panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-container);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  .panel-title {
    font: var(--td-font-body-medium);
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  &__layout {
    width: 168px;
  }
}

/* 左键盘右配置面板两栏；键盘在剩余空间内居中 */
.panel-body {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.keyboard-area {
  flex: 1;
  display: flex;
  justify-content: center;
}

/* 外壳内的分组横排（多组之间由 t-divider 视觉分隔） */
.keyboard {
  display: flex;
  align-items: center;
  gap: 4px;
  width: fit-content;
  padding: 16px;
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-extra);
  background: var(--td-bg-color-secondarycontainer);
  box-shadow:
    inset 0 2px 6px 0 rgba(0, 0, 0, 10%),
    0 2px 8px 0 rgba(0, 0, 0, 10%);

  --key-size: 88px;
}

/* 分组：一组等宽列的小 grid（跨行/跨列在组内生效） */
.keyboard__group {
  display: grid;
  grid-auto-rows: var(--key-size);
  gap: 12px;
}

/* 组间分隔：撑满键盘高度，作为纯视觉分隔不参与格位 */
.keyboard__divider {
  height: var(--key-size);
  margin: 0 8px;
}

/* 键槽 = grid item（大键位跨行/跨列在这里生效） */
.key-slot {
  display: flex;
}

/* 右侧配置面板常驻栏：未选键时显示空态，选中后承载 KeypadBindingPanel */
.side-panel {
  flex-shrink: 0;
  width: 300px;
  padding: 14px;
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-extra);
  background: var(--td-bg-color-container);

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 40px 0;
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
    text-align: center;
  }

  &__empty-icon {
    font-size: 28px;
  }
}

/* 空态/配置面板切换动效 */
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
