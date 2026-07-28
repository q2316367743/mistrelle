<template>
  <div class="dynamics-page">
    <div class="dynamics-page__toolbar">
      <t-button theme="primary" @click="handlePost">
        <template #icon><AddIcon /></template>
        发布留言
      </t-button>
      <t-radio-group v-model="filter" variant="primary-filled">
        <t-radio-button value="me">与我相关</t-radio-button>
        <t-radio-button value="all">成员动态</t-radio-button>
      </t-radio-group>
    </div>

    <div class="dynamics-page__list">
      <t-empty
        :title="emptyTitle"
        :description="emptyDesc"
        class="dynamics-page__empty"
      />
    </div>

  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { AddIcon } from 'tdesign-icons-vue-next'

const filter = ref<'me' | 'all'>('me')

const handlePost = () => {
  // TODO: 后续实现发布留言弹窗
}

const emptyTitle = computed(() => (filter.value === 'me' ? '暂无与我有关的动态' : '暂无成员动态'))
const emptyDesc = computed(() =>
  filter.value === 'me' ? '项目成员的活动会显示在这里' : '项目成员发布的内容会显示在这里'
)
</script>

<style scoped lang="less">
.dynamics-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;

  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  &__list {
    flex: 1;
    min-height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__empty {
    margin: 0;
  }

  &__chat {
    flex-shrink: 0;
    background: var(--td-bg-color-container);
    border: 1px solid var(--td-component-stroke);
    border-radius: var(--td-radius-medium);
    overflow: hidden;
  }

  &__chat-input {
    padding: 14px 16px;
    min-height: 64px;
    color: var(--td-text-color-placeholder);
    font: var(--td-font-body-medium);
  }

  &__chat-toolbar {
    display: flex;
    gap: 16px;
    padding: 8px 12px;
    border-top: 1px solid var(--td-component-stroke);
  }

  &__chat-tool {
    color: var(--td-text-color-secondary);
    font: var(--td-font-body-small);
    cursor: pointer;
    user-select: none;

    &:hover {
      color: var(--td-text-color-primary);
    }
  }
}
</style>
