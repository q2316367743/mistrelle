<template>
  <div class="page-layout">
    <header class="page-header" :class="{ collapsed: collapsed }">
      <div class="page-header__left">
        <div class="page-header__title">
          <slot v-if="slots['title']" name="title"></slot>
          <span v-else-if="title">{{ title }}</span>
        </div>
      </div>
      <div v-if="slots['extra']" class="page-header__right">
        <slot name="extra"></slot>
      </div>
    </header>
    <div class="page-container">
      <slot />
    </div>
    <t-back-top container=".page-layout .page-container" />
  </div>
</template>
<script lang="ts" setup>
import { collapsed } from '@/global/BeanFactory'
import { useTitlePadding } from '@/hooks'

const props = defineProps({
  title: String,
  pl: String
})
const slots = defineSlots()
const { l2, r1 } = useTitlePadding()
const paddingLeft = computed(() => props.pl ?? `${l2}px`)
const paddingRight = computed(() => `${24 + r1}px`)
</script>
<style scoped lang="less">
.page-layout {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px v-bind(paddingRight) 8px 8px;
    height: 48px;
    box-sizing: border-box;
    color: var(--td-text-color-primary);
    transition: padding-left 0.1s ease-in-out;

    &.collapsed {
      padding-left: v-bind(paddingLeft);
    }

    &__left {
      display: flex;
      align-items: center;
    }

    &__title {
      display: flex;
      align-items: center;
      font-size: 20px;
      font-weight: 600;
    }

    &__right {
      z-index: 53;
      -webkit-app-region: no-drag;
    }
  }

  .page-container {
    position: absolute;
    top: 48px;
    left: 0;
    right: 0;
    bottom: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }
}
</style>
