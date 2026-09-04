<template>
  <page-layout title="AI HOT">
    <div class="aihot-page">
      <t-tabs v-model="active" class="aihot-page__tabs">
        <t-tab-panel value="items" label="精选" :destroy-on-hide="false" lazy>
          <aihot-items-view mode="selected" />
        </t-tab-panel>
        <t-tab-panel value="all" label="动态" :destroy-on-hide="false" lazy>
          <aihot-items-view mode="all" />
        </t-tab-panel>
        <t-tab-panel value="hot" label="热点" :destroy-on-hide="false" lazy>
          <aihot-hot-topics-view />
        </t-tab-panel>
        <t-tab-panel value="dailies" label="日报" :destroy-on-hide="false" lazy>
          <aihot-dailies-view />
        </t-tab-panel>
      </t-tabs>
    </div>
  </page-layout>
</template>
<script lang="ts" setup>
import AihotItemsView from './components/AihotItemsView.vue'
import AihotHotTopicsView from './components/AihotHotTopicsView.vue'
import AihotDailiesView from './components/AihotDailiesView.vue'

const active = ref('items')
</script>
<style scoped lang="less">
.aihot-page {
  height: 100%;
  padding: 12px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;

  &__tabs {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  // t-tabs 撑满剩余高度，面板作为各视图的滚动容器父级
  :deep(.t-tabs__content) {
    flex: 1;
    min-height: 0;
  }

  :deep(.t-tab-panel) {
    height: 100%;
  }
}
</style>
