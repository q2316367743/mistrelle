<template>
  <div class="ai-setting-sidebar">
    <div class="px-8px">
      <t-button theme="primary" block @click="emit('add')">
        <template #icon><AddIcon /></template>
        新增
      </t-button>
    </div>
    <t-divider size="8px" />
    <div ref="listRef" class="ai-setting-sidebar__list">
      <div
        v-for="item in items"
        :key="item.id"
        :class="[
          'ai-setting-sidebar__item',
          { 'is-active': selectedId === item.id, 'is-disabled': !item.enable }
        ]"
      >
        <span class="ai-setting-sidebar__drag" title="拖拽排序" @click.stop>
          <DragMoveIcon />
        </span>
        <div class="ai-setting-sidebar__item-content" @click="emit('select', item.id)">
          <span class="ai-setting-sidebar__item-name">{{ item.name || '未命名' }}</span>
        </div>
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
    <t-empty v-if="items.length === 0" description="暂无提供方，点击新增添加" />
  </div>
</template>

<script lang="ts" setup>
import Sortable from 'sortablejs'
import { AddIcon, DeleteIcon, DragMoveIcon } from 'tdesign-icons-vue-next'
import { useSettingAiStore } from '@/store'

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
const items = computed(() => store.items)
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
  if (!listRef.value) return
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
      void store.reorder(oldIndex, newIndex)
    }
  })
})

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
  border-right: 1px solid var(--td-border-level-1-color);

  &__list {
    flex: 1;
    overflow-y: auto;
    padding: 0 8px;
  }

  &__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 8px 8px 4px;
    border-radius: var(--td-radius-default);
    transition: background-color 0.2s;
    margin-bottom: 4px;

    &:hover {
      background-color: var(--td-bg-color-secondaryhover);
    }

    &.is-active {
      background-color: var(--td-brand-color-light);
    }

    &.is-ghost {
      opacity: 0.4;
      background-color: var(--td-bg-color-container-hover);
    }

    &.is-chosen {
      background-color: var(--td-bg-color-container-hover);
    }

    &.is-dragging {
      box-shadow: var(--td-shadow-2);
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
  }

  &__item-content {
    flex: 1;
    min-width: 0;
    cursor: pointer;
  }

  &__item-name {
    display: block;
    font-size: 14px;
    color: var(--td-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__item.is-disabled &__item-name {
    color: var(--td-text-color-placeholder);
  }
}
</style>
