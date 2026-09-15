<template>
  <div class="todo-list">
    <div v-for="todo in todos" :key="todo.id" class="todo-item" :class="`todo-item--${todo.status}`">
      <check-circle-icon v-if="todo.status === 'completed'" class="todo-item__icon" />
      <circle-icon v-else-if="todo.status === 'pending'" class="todo-item__icon" />
      <loading-icon v-else class="todo-item__icon todo-item__icon--loading" />
      <span class="todo-item__content">{{ todo.content }}</span>
      <t-tag
        v-if="todo.status === 'in_progress'"
        theme="primary"
        variant="light"
        size="small"
        class="todo-item__tag"
      >
        进行中
      </t-tag>
    </div>
    <div v-if="todos.length === 0" class="todo-list__empty">暂无待办</div>
  </div>
</template>
<script lang="ts" setup>
import type { TodoItem } from '@/domain'
import { CheckCircleIcon, CircleIcon, LoadingIcon } from 'tdesign-icons-vue-next'

withDefaults(
  defineProps<{
    todos: TodoItem[]
  }>(),
  {
    todos: () => []
  }
)
</script>
<style scoped lang="less">
.todo-list {
  display: flex;
  flex-direction: column;
  gap: var(--td-comp-margin-s);
  padding: var(--td-comp-paddingTB-xs) var(--td-comp-paddingLR-s);

  &__empty {
    padding: var(--td-comp-paddingTB-m) 0;
    text-align: center;
    color: var(--td-text-color-placeholder);
    font-size: var(--td-font-size-body-small);
  }
}

.todo-item {
  display: flex;
  align-items: flex-start;
  gap: var(--td-comp-margin-s);
  min-width: 0;

  &__icon {
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--td-text-color-placeholder);
    font-size: var(--td-font-size-body-large);

    &--loading {
      color: var(--td-brand-color);
      animation: todo-item-spin 1s linear infinite;
    }
  }

  &__content {
    flex: 1;
    min-width: 0;
    word-break: break-word;
    line-height: var(--td-line-height-body-medium);
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-primary);
  }

  &--completed &__content {
    text-decoration: line-through;
    color: var(--td-text-color-placeholder);
  }

  &--completed &__icon {
    color: var(--td-success-color);
  }

  &--in_progress &__content {
    color: var(--td-brand-color);
  }

  &__tag {
    flex-shrink: 0;
    margin-top: -2px;
  }
}

@keyframes todo-item-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
