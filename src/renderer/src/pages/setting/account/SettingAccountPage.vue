<template>
  <page-layout title="账号设置">
    <t-list class="setting-list" split size="small">
      <t-list-item>
        <t-list-item-meta title="用户名" />
        <template #action>
          <div class="flex gap-8px">
            <t-radio-group v-model="state.avatar" default-value="man">
              <t-radio value="man">
                <user-man-icon />
              </t-radio>
              <t-radio value="woman">
                <user-woman-icon />
              </t-radio>
            </t-radio-group>
            <t-input v-model="state.nickname" style="width: 200px" allow-clear />
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
  </page-layout>
</template>
<script lang="ts" setup>
import { useSettingAccountStore } from '@/store'
import UserManIcon from '@/assets/icons/UserManIcon.vue'
import UserWomanIcon from '@/assets/icons/UserWomanIcon.vue'

const { state } = toRefs(useSettingAccountStore())
</script>
<style scoped lang="less">
.setting-list {
  padding: 0 8px 8px 8px;
}
</style>
