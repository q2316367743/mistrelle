<template>
  <page-layout title="账号设置">
    <server-account-card />
    <t-card size="small" title="第三方账号" class="mx-16px mb-16px">
      <t-list class="setting-list" split size="small">
        <t-list-item>
          <t-list-item-meta title="SkillHub API Key" description="用于访问 SkillHub 服务" />
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
        <t-list-item>
          <t-list-item-meta
            title="知乎数据开放平台"
            description="用于 zhihu_search 等知乎开放接口；在个人中心获取 Access Secret"
          />
          <template #action>
            <div class="flex items-center gap-8px">
              <t-input
                v-model="state.zhihu"
                style="width: 400px"
                placeholder="请输入知乎 Access Secret"
                type="password"
                allow-clear
              />
              <m-link href="https://developer.zhihu.com/"> 获取 </m-link>
            </div>
          </template>
        </t-list-item>
      </t-list>
    </t-card>
  </page-layout>
</template>
<script lang="ts" setup>
import { useSettingAccountStore } from '@/store'
import ServerAccountCard from './components/ServerAccountCard.vue'

const { state } = toRefs(useSettingAccountStore())
</script>
<style scoped lang="less">
.setting-list {
  padding: 0 8px 8px 8px;
}
</style>
