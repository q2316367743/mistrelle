<template>
  <section class="identity">
    <template v-if="authStore.status === 'signed-in'">
      <div class="identity__hero">
        <t-avatar class="identity__avatar" size="72px">{{ avatarText }}</t-avatar>
        <div class="identity__meta">
          <div class="identity__name-row">
            <h2 class="identity__name">{{ displayName }}</h2>
            <t-tag v-if="tierLabel" theme="primary" variant="light" size="small">
              {{ tierLabel }}
            </t-tag>
          </div>
          <p class="identity__email">{{ user?.email }}</p>
          <p v-if="expireLabel" class="identity__expire">会员至 {{ expireLabel }}</p>
        </div>
        <t-button
          class="identity__refresh"
          variant="text"
          size="small"
          :loading="refreshing"
          @click="handleRefresh"
        >
          刷新
        </t-button>
      </div>
      <div
        v-if="balance"
        class="identity__metrics is-clickable"
        role="button"
        tabindex="0"
        @click="openPointsLedger"
        @keydown.enter.prevent="openPointsLedger"
      >
        <div class="metric">
          <span class="metric__label">可用积分</span>
          <span class="metric__value">{{ balance.total }}</span>
          <span class="metric__hint">查看流水</span>
        </div>
        <div class="metric">
          <span class="metric__label">每日赠送</span>
          <span class="metric__value">
            {{ balance.pointsGift }}
            <span class="metric__hint"> / {{ balance.giftQuota }}</span>
          </span>
        </div>
      </div>
    </template>

    <template v-else-if="authStore.status === 'unknown'">
      <div class="identity__hero">
        <t-avatar class="identity__avatar" size="72px">
          <template #icon>
            <t-icon name="user" />
          </template>
        </t-avatar>
        <div class="identity__meta">
          <h2 class="identity__name">正在连接服务端</h2>
          <p class="identity__email">请确认本地服务已启动后重试</p>
        </div>
        <t-button size="small" variant="outline" :loading="refreshing" @click="handleRefresh">
          重试连接
        </t-button>
      </div>
    </template>

    <template v-else>
      <div class="identity__hero">
        <t-avatar class="identity__avatar" size="72px">
          <template #icon>
            <t-icon name="user" />
          </template>
        </t-avatar>
        <div class="identity__meta">
          <h2 class="identity__name">未登录</h2>
          <p class="identity__email">登录后可查看积分余额，并管理会员与账号安全</p>
        </div>
        <div class="identity__cta">
          <t-button size="small" theme="primary" @click="openLogin()">登录 / 注册</t-button>
          <t-button size="small" variant="outline" @click="handleMemberTier">会员档位</t-button>
        </div>
      </div>
    </template>
  </section>
</template>
<script lang="ts" setup>
import { useAuthStore } from '@/store'
import { toDateString } from '@/utils/lang/FormatUtil'
import { openLogin } from '@/components/modals/LoginDialog'
import { openMemberTier } from '../modals/MemberTierDialog'
import { openPointsLedger } from '../modals/PointsLedgerDrawer'

const authStore = useAuthStore()
const user = computed(() => authStore.user)
const balance = computed(() => authStore.balance)
const refreshing = ref(false)

const displayName = computed(() => user.value?.name || '未设置昵称')

const avatarText = computed(() => {
  const name = user.value?.name?.trim()
  return name ? name.slice(0, 1) : '未'
})

const tierLabel = computed(() => {
  const code = user.value?.tier
  if (!code) return null
  return authStore.tiers.find((item) => item.code === code)?.name ?? code
})

const expireLabel = computed(() => {
  const expiresAt = user.value?.membership?.expiresAt
  if (!expiresAt) return null
  return toDateString(expiresAt, 'YYYY年M月D日')
})

function handleMemberTier(): void {
  openMemberTier(authStore.tiers, authStore.user?.tier ?? null)
}

async function handleRefresh(): Promise<void> {
  refreshing.value = true
  try {
    await authStore.refresh()
  } finally {
    refreshing.value = false
  }
}
</script>
<style scoped lang="less">
.identity {
  background: var(--fluent-card-bg);
  border: 1px solid var(--fluent-card-border);
  border-radius: var(--fluent-radius-card);
  box-shadow: var(--fluent-elevation-1);
  overflow: hidden;
}

.identity__hero {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 20px 16px;
}

.identity__avatar {
  flex: none;
  background: var(--td-brand-color);
  color: var(--td-text-color-anti);
  font: var(--td-font-title-large);
}

.identity__meta {
  flex: 1;
  min-width: 0;
}

.identity__name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.identity__name {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font: var(--td-font-title-large);
  color: var(--td-text-color-primary);
}

.identity__email,
.identity__expire {
  margin: 4px 0 0;
  font: var(--td-font-body-medium);
  color: var(--td-text-color-secondary);
}

.identity__refresh,
.identity__cta {
  flex: none;
}

.identity__cta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.identity__metrics {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  border-top: 1px solid var(--td-component-stroke);
  transition: background-color var(--fluent-transition-fast);

  &.is-clickable {
    cursor: pointer;

    &:hover {
      background: var(--fluent-item-hover);
    }

    &:focus-visible {
      outline: none;
      box-shadow: var(--fluent-focus-ring);
    }
  }
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 20px 16px;

  & + & {
    border-left: 1px solid var(--td-component-stroke);
  }

  &__label {
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
  }

  &__value {
    font: var(--td-font-title-medium);
    color: var(--td-text-color-primary);
  }

  &__hint {
    color: var(--td-text-color-placeholder);
  }
}

@media (max-width: 640px) {
  .identity__hero {
    flex-wrap: wrap;
  }

  .identity__metrics {
    grid-template-columns: 1fr;
  }

  .metric + .metric {
    border-left: none;
    border-top: 1px solid var(--td-component-stroke);
  }
}
</style>
