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
    <div
      class="keyboard"
      :style="{ gridTemplateColumns: `repeat(${layout.columns}, var(--key-size))` }"
    >
      <div v-for="cell in layout.cells" :key="cell.keyId" class="key-slot" :style="spanStyle(cell)">
        <t-popup
          trigger="click"
          placement="bottom"
          show-arrow
          :visible="activeKeyId === cell.keyId"
          :destroy-on-close="true"
          @visible-change="(visible: boolean) => onPopupVisible(cell.keyId, visible)"
        >
          <keypad-key-cap :key-id="cell.keyId" :action="bindingOf(cell.keyId)" />
          <template #content>
            <keypad-binding-panel :key-id="cell.keyId" @close="activeKeyId = null" />
          </template>
        </t-popup>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { KeypadAction } from '@common/types/keypad'
import { isKeypadLayoutId } from '@common/types/keypad'
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

/** popup 打开中的键位；visible-change 两段防竞争（新开优先，旧的 false 不覆盖新的 true） */
const activeKeyId = ref<string | null>(null)

function onPopupVisible(keyId: string, visible: boolean): void {
  if (visible) {
    activeKeyId.value = keyId
    return
  }
  if (activeKeyId.value === keyId) activeKeyId.value = null
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

/* 键槽 = grid item（大键位跨行/跨列在这里生效）；popup 包在槽内，不参与网格布局 */
.key-slot {
  display: flex;

  :deep(.t-popup) {
    display: block;
    width: 100%;
    height: 100%;
  }
}

/* 键盘外壳：格子固定正方形尺寸（合并键 = 整数倍格子，不变形），整体在外壳内居中 */
.keyboard {
  display: grid;
  grid-template-columns: repeat(4, var(--key-size));
  grid-auto-rows: var(--key-size);
  gap: 12px;
  width: fit-content;
  margin:  auto;
  padding: 16px;
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-extra);
  background: var(--td-bg-color-secondarycontainer);
  box-shadow:
    inset 0 2px 6px 0 rgba(0, 0, 0, 10%),
    0 2px 8px 0 rgba(0, 0, 0, 10%);

  --key-size: 88px;
}
</style>
