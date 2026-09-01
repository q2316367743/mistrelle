<template>
  <section class="account-group">
    <h2 class="account-group__title">第三方账号</h2>
    <div class="account-surface">
      <account-setting-row
        icon="key"
        title="SkillHub API Key"
        description="用于访问 SkillHub 技能市场"
      >
        <template #action>
          <t-tag v-if="state.skillhub" theme="success" variant="light" size="small">已配置</t-tag>
          <t-tag v-else variant="light" size="small">未配置</t-tag>
        </template>
        <div class="key-field">
          <t-input
            v-model="state.skillhub"
            class="key-field__input"
            type="password"
            placeholder="请输入 SkillHub API Key"
            clearable
          />
          <m-link href="https://skillhub.cn/dashboard/keys">获取</m-link>
        </div>
      </account-setting-row>
      <account-setting-row
        icon="internet"
        title="知乎数据开放平台"
        description="用于 zhihu_search 等知乎开放接口"
      >
        <template #action>
          <t-tag v-if="state.zhihu" theme="success" variant="light" size="small">已配置</t-tag>
          <t-tag v-else variant="light" size="small">未配置</t-tag>
        </template>
        <div class="key-field">
          <t-input
            v-model="state.zhihu"
            class="key-field__input"
            type="password"
            placeholder="请输入知乎 Access Secret"
            clearable
          />
          <m-link href="https://developer.zhihu.com/">获取</m-link>
        </div>
      </account-setting-row>
    </div>
  </section>
</template>
<script lang="ts" setup>
import { useSettingAccountStore } from '@/store'
import AccountSettingRow from './AccountSettingRow.vue'

const { state } = toRefs(useSettingAccountStore())
</script>
<style scoped lang="less">
.account-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.account-group__title {
  margin: 0;
  padding-left: 4px;
  font: var(--td-font-title-small);
  color: var(--td-text-color-secondary);
}

.account-surface {
  background: var(--fluent-card-bg);
  border: 1px solid var(--fluent-card-border);
  border-radius: var(--fluent-radius-card);
  box-shadow: var(--fluent-elevation-1);
  overflow: hidden;
}

.key-field {
  display: flex;
  align-items: center;
  gap: 12px;

  &__input {
    flex: 1;
    min-width: 0;
  }
}
</style>
