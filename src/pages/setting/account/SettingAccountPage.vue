<template>
  <page-layout title="账号设置">
    <t-list class="setting-list" split size="small">
      <t-list-item>
        <t-list-item-meta
          title="SkillHub API Key"
          description="用于访问 SkillHub 服务，可前往 skillhub.cn/dashboard/keys 获取"
        />
        <template #action>
          <div class="flex items-center gap-8px">
            <t-input
              v-model="state.skillhub"
              style="width: 400px"
              placeholder="请输入 SkillHub API Key"
              type="password"
              allow-clear
            />
            <m-link href="https://skillhub.cn/dashboard/keys"> 获取 </m-link>
          </div>
        </template>
      </t-list-item>
    </t-list>
  </page-layout>
</template>
<script lang="ts" setup>
import { useSettingAccountStore } from '@/store'

const { state } = toRefs(useSettingAccountStore())
</script>
<style scoped lang="less">
.setting-list {
  padding: 0 16px 16px 16px;
}
</style>
