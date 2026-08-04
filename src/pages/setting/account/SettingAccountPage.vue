<template>
  <page-layout title="账号设置">
    <t-list class="setting-list" split size="small">
      <t-list-item>
        <t-list-item-meta title="用户名" />
        <template #action>
          <div class="flex gap-8px">
            <t-input v-model="state.nickname" style="width: 200px" allow-clear />
            <t-button v-if="isUtools" @click="resetNickname">重置</t-button>
          </div>
        </template>
      </t-list-item>
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
          title="Context7 API Key"
          description="代码开发类型下获取第三方类库最新文档；留空则使用免 key 的匿名额度"
        />
        <template #action>
          <div class="flex items-center gap-8px">
            <t-input
              v-model="state.context7"
              style="width: 400px"
              placeholder="请输入 Context7 API Key（可选）"
              type="password"
              allow-clear
            />
            <m-link href="https://context7.com"> 获取 </m-link>
          </div>
        </template>
      </t-list-item>
    </t-list>
  </page-layout>
</template>
<script lang="ts" setup>
import { useSettingAccountStore } from '@/store'

const { state } = toRefs(useSettingAccountStore())
const isUtools = window.preload.inject.getPlatform() === 'utools'

const resetNickname = () => {
  if (window.preload.inject.getPlatform() === 'utools') {
    const user = window.preload.inject.os.getUser()
    if (user) {
      state.value.avatar = user.avatar
      state.value.nickname = user.nickname
    }
  }
}
</script>
<style scoped lang="less">
.setting-list {
  padding: 0 8px 8px 8px;
}
</style>
