<template>
  <div class="ai-setting-sidebar">
    <!-- 内置供应商（服务端中转站）：免费档也可用，恒启用，不可编辑/删除 -->
    <template v-if="builtinItem">
      <div class="ai-setting-sidebar__group-title">内置</div>
      <div class="ai-setting-sidebar__list ai-setting-sidebar__list--auto">
        <div
          :class="[
            'ai-setting-sidebar__item',
            { 'is-active': selectedId === builtinItem.id }
          ]"
        >
          <span class="ai-setting-sidebar__drag is-locked" title="内置供应商不可拖拽">
            <DragMoveIcon />
          </span>
          <div class="ai-setting-sidebar__item-content" @click="emit('select', builtinItem.id)">
            <span class="ai-setting-sidebar__item-name">{{ builtinItem.name }}</span>
          </div>
          <t-tag size="small" variant="light" theme="primary">内置</t-tag>
        </div>
      </div>
    </template>

    <!-- 自定义供应商（thirdPartyRelay 门控：免费档整组隐藏） -->
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
      <t-empty v-if="customItems.length === 0" description="暂无自定义供应商" />
    </template>

    <!-- 添加供应商：置于自定义供应商分组下方（免费档隐藏） -->
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
const relayEnabled = computed(() => store.relayEnabled)
/** 内置供应商（恒存在，items 首项） */
const builtinItem = computed(() => store.items.find((i) => i.builtin))
/** 自定义供应商（付费档展示） */
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
      // 自定义组内索引 → 全局 items 索引（跳过内置首项）
      const from = store.items.findIndex((i) => !i.builtin)
      void store.reorder(from + oldIndex, from + newIndex)
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

  &__group-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--td-text-color-secondary);
    padding: 0 8px 8px;
  }

  &__list {
    overflow-y: auto;
    padding: 0 8px;
  }

  // 内置列表只占内容高度；自定义列表撑满剩余空间并滚动
  &__list--auto {
    flex: none;
  }

  &__list--scroll {
    flex: 1;
    min-height: 0;
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

    &.is-locked {
      cursor: not-allowed;
      color: var(--td-text-color-disabled);
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

  &__add {
    padding: 8px;
  }
}
</style>
