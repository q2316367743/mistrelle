<template>
  <nav class="menu-list" aria-label="主菜单">
    <SideMenuNode v-for="item in items" :key="item.label" :item="item" />
  </nav>
</template>

<script lang="ts">
import type { Component } from 'vue'

export interface SideMenuItem {
  label: string
  icon?: Component
  /** 点击导航目标；存在 children 时一般为空（仅用于展开/收起） */
  to?: string
  /** to 判定 active 的方式，默认 exact */
  match?: 'exact' | 'prefix'
  /** 额外按前缀判定 active 的路径，仅作用于自身（不因子孙选中而高亮） */
  activePaths?: string[]
  children?: SideMenuItem[]
}
</script>

<script lang="ts" setup>
import SideMenuNode from './SideMenuNode.vue'

defineProps<{ items: SideMenuItem[] }>()
</script>

<style scoped lang="less">
.menu-list {
  display: flex;
  flex-direction: column;
  gap: var(--td-comp-margin-xs);
  min-height: 0;
  width: 204px;
  height: fit-content;
  overflow: hidden;
}
</style>
