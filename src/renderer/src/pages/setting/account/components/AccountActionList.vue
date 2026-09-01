<template>
  <section class="account-group">
    <h2 class="account-group__title">账户与安全</h2>
    <div class="account-surface">
      <account-setting-row
        icon="user-vip"
        title="我的会员"
        :description="memberDesc"
        arrow
        clickable
        @click="handleMemberTier"
      />
      <account-setting-row
        icon="wallet"
        title="积分流水"
        description="查看积分收支明细"
        arrow
        clickable
        @click="openPointsLedger"
      />
      <account-setting-row
        icon="gift"
        title="激活码"
        description="兑换会员档位或积分包"
        arrow
        clickable
        @click="openRedeemCode"
      />
      <account-setting-row
        icon="edit-1"
        title="修改用户名"
        description="更改在服务端显示的名称"
        arrow
        clickable
        @click="handleEditName"
      />
      <account-setting-row
        icon="lock-on"
        title="修改密码"
        description="更新登录密码，当前会话保持有效"
        arrow
        clickable
        @click="handleChangePassword"
      />
      <account-setting-row
        icon="logout"
        title="退出登录"
        description="清除本机凭证，不影响云端账号"
        danger
      >
        <template #action>
          <t-button size="small" variant="outline" theme="danger" @click="handleSignOut">
            退出
          </t-button>
        </template>
      </account-setting-row>
    </div>
  </section>
</template>
<script lang="ts" setup>
import { useAuthStore } from '@/store'
import { MessageUtil } from '@/utils/modal'
import { openEditName } from '../modals/EditNameDialog'
import { openChangePassword } from '../modals/ChangePasswordDialog'
import { openMemberTier } from '../modals/MemberTierDialog'
import { openRedeemCode } from '../modals/RedeemCodeDialog'
import { openPointsLedger } from '../modals/PointsLedgerDrawer'
import AccountSettingRow from './AccountSettingRow.vue'

const authStore = useAuthStore()

const memberDesc = computed(() => {
  const code = authStore.user?.tier
  if (!code) return '查看档位权益与价格'
  const name = authStore.tiers.find((item) => item.code === code)?.name
  return name ? `当前档位：${name}` : '查看档位权益与价格'
})

function handleMemberTier(): void {
  openMemberTier(authStore.tiers, authStore.user?.tier ?? null)
}

function handleEditName(): void {
  openEditName(authStore.user?.name ?? '')
}

function handleChangePassword(): void {
  openChangePassword()
}

async function handleSignOut(): Promise<void> {
  const ok = await authStore.signOut()
  if (ok) MessageUtil.success('已退出登录')
}
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
</style>
