<template>
  <t-card title="服务端账号" :bordered="false" class="server-account-card">
    <template v-if="authStore.status === 'signed-in'">
      <div class="server-account-card__identity">
        <div class="server-account-card__name">
          <span class="server-account-card__name-text">{{ user?.name || '未设置昵称' }}</span>
          <t-tag v-if="user?.tier" variant="light" size="small">{{ user.tier }}</t-tag>
        </div>
        <div class="server-account-card__email">{{ user?.email }}</div>
      </div>
      <div v-if="balance" class="server-account-card__balance">
        <div class="server-account-card__balance-row">
          <span>总积分</span>
          <span>{{ balance.total }}</span>
        </div>
        <div class="server-account-card__balance-row">
          <span>每日赠送</span>
          <span
            >{{ balance.pointsGift
            }}<em v-if="balance.giftQuota"> / 额度 {{ balance.giftQuota }}</em></span
          >
        </div>
        <div class="server-account-card__balance-row">
          <span>充值积分</span>
          <span>{{ balance.pointsPaid }}</span>
        </div>
      </div>
      <div class="server-account-card__actions">
        <t-button size="small" variant="outline" @click="handleMemberTier">我的会员</t-button>
        <t-button size="small" variant="outline" @click="handleEditName">修改用户名</t-button>
        <t-button size="small" variant="outline" @click="handleChangePassword">修改密码</t-button>
        <t-button size="small" variant="outline" :loading="refreshing" @click="handleRefresh">
          刷新
        </t-button>
        <t-button size="small" variant="outline" theme="danger" @click="handleSignOut">
          退出登录
        </t-button>
      </div>
    </template>
    <template v-else-if="authStore.status === 'unknown'">
      <div class="server-account-card__hint">
        正在连接服务端或服务不可用，请确认本地服务已启动后重试
      </div>
      <div class="server-account-card__actions">
        <t-button size="small" variant="outline" :loading="refreshing" @click="handleRefresh">
          重试连接
        </t-button>
      </div>
    </template>
    <template v-else>
      <div class="server-account-card__hint">
        未登录本地服务端账号；积分余额需登录后查看（档位额度为公开信息）
      </div>
      <div class="server-account-card__actions">
        <t-button size="small" theme="primary" @click="openLogin">登录 / 注册</t-button>
        <t-button size="small" variant="outline" @click="handleMemberTier">
          会员档位{{ authStore.tiers.length ? `（${authStore.tiers.length} 个）` : '' }}
        </t-button>
      </div>
    </template>
  </t-card>
</template>
<script lang="ts" setup>
import { useAuthStore } from '@/store'
import { MessageUtil } from '@/utils/modal'
import { openLogin } from '@/components/modals/LoginDialog'
import { openEditName } from '../modals/EditNameDialog'
import { openChangePassword } from '../modals/ChangePasswordDialog'
import { openMemberTier } from '../modals/MemberTierDialog'

const authStore = useAuthStore()
const user = computed(() => authStore.user)
const balance = computed(() => authStore.balance)
const refreshing = ref(false)

function handleMemberTier(): void {
  openMemberTier(authStore.tiers, authStore.user?.tier ?? null)
}

function handleEditName(): void {
  openEditName(authStore.user?.name ?? '')
}

function handleChangePassword(): void {
  openChangePassword()
}

async function handleRefresh(): Promise<void> {
  refreshing.value = true
  try {
    await authStore.refresh()
  } finally {
    refreshing.value = false
  }
}

async function handleSignOut(): Promise<void> {
  const ok = await authStore.signOut()
  if (ok) MessageUtil.success('已退出登录')
}
</script>
<style scoped lang="less">
.server-account-card {
  margin: 16px;

  &__identity {
    margin-bottom: var(--td-comp-margin-s);
  }

  &__name {
    display: flex;
    align-items: center;
    gap: var(--td-comp-margin-s);
    font: var(--td-font-title-medium);
    color: var(--td-text-color-primary);

    &-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  &__email {
    margin-top: var(--td-comp-margin-xxs);
    font: var(--td-font-body-medium);
    color: var(--td-text-color-secondary);
  }

  &__balance {
    display: flex;
    flex-direction: column;
    gap: var(--td-comp-margin-xxs);
    padding: var(--td-comp-paddingLR-xs) var(--td-comp-paddingLR-s);
    background: var(--td-bg-color-container-hover);
    border-radius: var(--td-radius-medium);

    &-row {
      display: flex;
      justify-content: space-between;
      font: var(--td-font-body-medium);
      color: var(--td-text-color-primary);

      em {
        font-style: normal;
        color: var(--td-text-color-secondary);
      }
    }
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--td-comp-margin-s);
    margin-top: var(--td-comp-margin-m);
  }

  &__hint {
    font: var(--td-font-body-medium);
    color: var(--td-text-color-secondary);
  }
}
</style>
