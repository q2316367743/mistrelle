<template>
  <t-popup
    v-if="totalSteps > 0"
    trigger="click"
    placement="bottom-right"
    :overlay-inner-style="popupStyle"
  >
    <t-button theme="default" variant="text" class="todo-progress-btn">
      <t-progress theme="circle" :percentage="todoPercent" :size="22" :stroke-width="3" :label="false" />
      <span class="todo-progress-btn__text">第 {{ currentStep }} / {{ totalSteps }} 步</span>
    </t-button>
    <template #content>
      <todo-list :todos="todos" />
    </template>
  </t-popup>
</template>
<script lang="ts" setup>
import type { TodoItem } from '@/domain'
import TodoList from '@/components/chat/TodoList.vue'

const props = withDefaults(
  defineProps<{
    todos: TodoItem[]
  }>(),
  {
    todos: () => []
  }
)

const totalSteps = computed(() => props.todos.length)

/** 当前进行步骤序号（1 起）：优先取 in_progress 项，无则取第一个未完成项，全部完成取总数 */
const currentStep = computed(() => {
  if (totalSteps.value === 0) return 0
  const list = props.todos
  const inProgressIdx = list.findIndex((todo) => todo.status === 'in_progress')
  if (inProgressIdx !== -1) return inProgressIdx + 1
  const firstUnfinished = list.findIndex((todo) => todo.status !== 'completed')
  if (firstUnfinished !== -1) return firstUnfinished + 1
  return list.length
})

/** 已完成比例（圆环进度） */
const todoPercent = computed(() => {
  if (totalSteps.value === 0) return 0
  const completed = props.todos.filter((todo) => todo.status === 'completed').length
  return Math.round((completed / totalSteps.value) * 100)
})

/** 长列表时限制弹层高度并允许滚动 */
const popupStyle = { maxHeight: '300px', overflow: 'auto', padding: '4px' }
</script>
<style scoped lang="less">
.todo-progress-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--td-comp-margin-xs);
  padding-left: var(--td-comp-paddingLR-s);
  padding-right: var(--td-comp-paddingLR-s);

  &__text {
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-primary);
    white-space: nowrap;
    margin-left: 8px;
  }
}
</style>
