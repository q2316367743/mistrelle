<template>
  <div class="ai-setting-sidebar">
    <template v-if="builtinItem">
      <div class="ai-setting-sidebar__group-title">内置</div>
      <div class="ai-setting-sidebar__list ai-setting-sidebar__list--auto">
        <button
          type="button"
          :class="[
            'ai-setting-sidebar__item',
            { 'is-active': selectedId === builtinItem.id }
          ]"
          @click="emit('select', builtinItem.id)"
        >
          <span class="ai-setting-sidebar__drag is-locked" title="内置供应商不可拖拽">
            <DragMoveIcon />
          </span>
          <span class="ai-setting-sidebar__item-content">
            <span class="ai-setting-sidebar__item-name">{{ builtinItem.name }}</span>
          </span>
          <t-tag size="small" variant="light" theme="primary">内置</t-tag>
        </button>
      </div>
    </template>

    <template v-if="relayEnabled && customItems.length > 0">
      <t-divider size="8px" />
      <div class="ai-setting-sidebar__group-title">自定义供应商</div>
      <div ref="listRef" class="ai-setting-sidebar__list ai-setting-sidebar__list--scroll">
        <div
          v-for="item in customItems"
          :key="item.id"
          :class="[
            'ai-setting-sidebar__item',
            { 'is-active': selectedId === item.id, 'is-disabled': !item.enable }
          ]"
        >
          <span class="ai-setting-sidebar__drag" title="拖拽排序" @click.stop>
            <DragMoveIcon />
          </span>
          <button
            type="button"
            class="ai-setting-sidebar__item-content"
            @click="emit('select', item.id)"
          >
            <span class="ai-setting-sidebar__item-name">{{ item.name || '未命名' }}</span>
          </button>
          <t-switch
            size="small"
            :value="item.enable"
            :default-value="true"
            @click.stop
            @change="(val) => emit('enable', item.id, Boolean(val))"
          />
          <t-popconfirm content="确定删除此提供方？" @confirm="emit('delete', item.id)">
            <t-button theme="danger" variant="text" size="small">
              <template #icon><DeleteIcon /></template>
            </t-button>
          </t-popconfirm>
        </div>
      </div>
    </template>

    <template v-if="relayEnabled">
      <div class="ai-setting-sidebar__add">
        <t-button theme="primary" variant="outline" block @click="emit('add')">
          <template #icon><AddIcon /></template>
          添加供应商
        </t-button>
      </div>
    </template>
  </div>
</template>

<script lang="ts" setup>
import Sortable from 'sortablejs'
import { AddIcon, DeleteIcon, DragMoveIcon } from 'tdesign-icons-vue-next'
import { useSettingAiStore } from '@/windows/main/store'

defineProps<{
  selectedId: string
}>()

const emit = defineEmits<{
  add: []
  select: [id: string]
  enable: [id: string, val: boolean]
  delete: [id: string]
}>()

const store = useSettingAiStore()
const relayEnabled = computed(() => store.relayEnabled)
const builtinItem = computed(() => store.items.find((i) => i.builtin))
const customItems = computed(() => store.items.filter((i) => !i.builtin))
const listRef = ref<HTMLElement>()
let sortable: Sortable | undefined

function revertDom(evt: Sortable.SortableEvent) {
  const { oldIndex, item, from } = evt
  if (oldIndex == null) return
  from.removeChild(item)
  if (oldIndex >= from.children.length) {
    from.appendChild(item)
  } else {
    from.insertBefore(item, from.children[oldIndex])
  }
}

onMounted(() => {
  bindSortable()
})

watch(
  () => customItems.value.length,
  () => {
    nextTick(() => bindSortable())
  }
)

function bindSortable() {
  if (sortable || !listRef.value) return
  sortable = Sortable.create(listRef.value, {
    animation: 180,
    handle: '.ai-setting-sidebar__drag',
    ghostClass: 'is-ghost',
    chosenClass: 'is-chosen',
    dragClass: 'is-dragging',
    onEnd: (evt) => {
      const { oldIndex, newIndex } = evt
      if (oldIndex == null || newIndex == null || oldIndex === newIndex) return
      revertDom(evt)
      const from = store.items.findIndex((i) => !i.builtin)
      void store.reorder(from + oldIndex, from + newIndex)
    }
  })
}

onBeforeUnmount(() => {
  sortable?.destroy()
  sortable = undefined
})
</script>

<style scoped lang="less">
.ai-setting-sidebar {
  width: 288px;
  min-width: 288px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--fluent-sidebar-border);
  background: var(--fluent-sidebar-bg);
  padding: 8px 0;

  &__group-title {
    font: var(--td-font-body-small);
    font-weight: 600;
    color: var(--td-text-color-secondary);
    padding: 4px 16px 8px;
  }

  &__list {
    overflow-y: auto;
    padding: 0 8px;
  }

  &__list--auto {
    flex: none;
  }

  &__list--scroll {
    flex: 1;
    min-height: 0;
  }

  &__item {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    padding: 8px 8px 8px 4px;
    border: 1px solid transparent;
    border-radius: var(--fluent-radius-smooth);
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition:
      background-color var(--fluent-transition-fast),
      box-shadow var(--fluent-transition-fast);
    margin-bottom: 4px;
    box-sizing: border-box;

    &::before {
      position: absolute;
      left: 0;
      width: 3px;
      height: 18px;
      content: '';
      background: transparent;
      border-radius: var(--td-radius-round);
      transition: background var(--fluent-transition-fast);
    }

    &:hover {
      background-color: var(--fluent-item-hover);
    }

    &:focus-visible {
      outline: none;
      box-shadow: var(--fluent-focus-ring);
    }

    &.is-active {
      background-color: var(--fluent-item-selected);

      &::before {
        background: var(--fluent-item-selected-border);
      }
    }

    &.is-ghost {
      opacity: 0.4;
      background-color: var(--fluent-item-hover);
    }

    &.is-chosen {
      background-color: var(--fluent-item-hover);
    }

    &.is-dragging {
      box-shadow: var(--fluent-elevation-2);
    }
  }

  &__drag {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 20px;
    color: var(--td-text-color-placeholder);
    cursor: grab;

    &:active {
      cursor: grabbing;
    }

    &.is-locked {
      cursor: not-allowed;
      color: var(--td-text-color-disabled);
    }
  }

  &__item-content {
    flex: 1;
    min-width: 0;
    padding: 0;
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  &__item-name {
    display: block;
    font: var(--td-font-body-medium);
    color: var(--td-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__item.is-disabled &__item-name {
    color: var(--td-text-color-placeholder);
  }

  &__add {
    padding: 8px;
  }
}
</style>
