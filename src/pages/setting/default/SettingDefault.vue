<template>
  <page-layout title="默认设置">
    <t-list class="setting-list" split size="small">
      <t-list-item>
        <t-list-item-meta title="默认助手模型" description="创建新助手时使用的模型" />
        <template #action>
          <t-select
            v-model="state.defaultAssistantModel"
            :options="options"
            class="w-360px"
            placeholder="请选择默认助手模型"
            clearable
          />
        </template>
      </t-list-item>
      <t-list-item>
        <t-list-item-meta
          title="默认快速模型"
          description="执行话题命名、搜索关键字提炼等简单任务时使用的模型"
        />
        <template #action>
          <t-select
            v-model="state.defaultQuickModel"
            :options="options"
            class="w-360px"
            placeholder="请选择默认快速模型"
            clearable
          />
        </template>
      </t-list-item>
      <t-list-item>
        <t-list-item-meta title="默认翻译模型" description="翻译服务使用的模型" />
        <template #action>
          <t-select
            v-model="state.defaultTranslateModel"
            :options="options"
            class="w-360px"
            placeholder="请选择默认翻译模型"
            clearable
          />
        </template>
      </t-list-item>
      <t-list-item>
        <t-list-item-meta title="默认向量模型" description="全局记忆使用的模型" />
        <template #action>
          <t-select
            v-model="state.defaultVectorModel"
            :options="vectorOptions"
            class="w-360px"
            placeholder="请选择默认向量模型"
            clearable
          />
        </template>
      </t-list-item>
    </t-list>
  </page-layout>
</template>
<script lang="ts" setup>
import { useSettingDefaultStore, useSettingAiStore } from '@/store'

const { state } = toRefs(useSettingDefaultStore())
const { options, vectorOptions } = toRefs(useSettingAiStore())
</script>
<style scoped lang="less">
.setting-list {
  padding: 0 16px 16px 16px;
}
</style>
