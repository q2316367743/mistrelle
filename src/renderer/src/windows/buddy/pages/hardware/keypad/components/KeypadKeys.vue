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
        <div
          class="keyboard"
          :style="{ gridTemplateColumns: `repeat(${layout.columns}, var(--key-size))` }"
        >
          <div v-for="cell in layout.cells" :key="cell.keyId" class="key-slot" :style="spanStyle(cell)">
            <keypad-key-cap
              :key-id="cell.keyId"
              :action="bindingOf(cell.keyId)"
              :selected="activeKeyId === cell.keyId"
              @select="onKeySelect(cell.keyId)"
            />
          </div>
        </div>
      </div>
      <aside class="side-panel">
        <Transition name="panel-fade" mode="out-in">
          <keypad-binding-panel
            v-if="activeKeyId"
            :key="activeKeyId"
            :key-id="activeKeyId"
            @close="activeKeyId = null"
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
import type { KeypadAction } from '@common/types/keypad'
import { isKeypadLayoutId } from '@common/types/keypad'
import { GestureClickIcon } from 'tdesign-icons-vue-next'
import KeypadKeyCap from './KeypadKeyCap.vue'
import KeypadBindingPanel from './KeypadBindingPanel.vue'
import { KEYPAD_LAYOUTS, keypadLayoutOf, type KeypadLayoutCell } from './keypadLayouts'
import { useKeypad } from '../useKeypad'

defineOptions({ name: 'KeypadKeys' })

const { config, saveLayout } = useKeypad()

/** 当前布局（main 配置持有；未回读时缺省首个） */
const layout = computed(() => keypadLayoutOf(config.value?.layout))

const layoutOptions = KEYPAD_LAYOUTS.map((item) => ({ value: item.id, label: item.label }))

function onLayoutChange(value: unknown): void {
  if (typeof value !== 'string' || !isKeypadLayoutId(value)) return
  void saveLayout(value)
}

function bindingOf(keyId: string): KeypadAction | null {
  return config.value?.bindings[keyId] ?? null
}

/** 大键位跨行/跨列（作用于键槽 grid item 上） */
function spanStyle(cell: KeypadLayoutCell): Record<string, string> {
  return {
    gridColumn: `span ${cell.cols ?? 1}`,
    gridRow: `span ${cell.rows ?? 1}`
  }
}

/** 配置面板打开中的键位；点其他键切换、再点同一键关闭（X/保存/清除同样关闭） */
const activeKeyId = ref<string | null>(null)

function onKeySelect(keyId: string): void {
  activeKeyId.value = activeKeyId.value === keyId ? null : keyId
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

/* 键盘外壳：格子固定正方形尺寸（合并键 = 整数倍格子，不变形），整体在外壳内居中 */
.keyboard {
  display: grid;
  grid-template-columns: repeat(4, var(--key-size));
  grid-auto-rows: var(--key-size);
  gap: 12px;
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
