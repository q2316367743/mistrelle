<template>
  <t-popup
    v-model:visible="visible"
    trigger="click"
    placement="top-left"
    :overlay-inner-style="overlayInnerStyle"
    @visible-change="onVisibleChange"
  >
    <button class="menu-item" type="button">
      <t-avatar v-if="signedIn" size="24px">{{ avatarText }}</t-avatar>
      <t-avatar v-else size="24px">
        <template #icon>
          <user-icon />
        </template>
      </t-avatar>
      <span class="menu-item__name">{{ displayName }}</span>
    </button>
    <template #content>
      <div class="user-panel">
        <div class="user-panel__header">
          <span class="user-panel__name">{{ displayName }}</span>
          <t-button
            v-if="signedIn"
            variant="text"
            shape="square"
            size="small"
            title="复制用户名"
            @click="handleCopy"
          >
            <template #icon>
              <file-copy-icon />
            </template>
          </t-button>
        </div>

        <t-divider class="user-panel__rule" />

        <user-menu-row :icon="UserIcon" :label="tierLabel" clickable @click="handleMember">
          <t-button size="small" shape="round" theme="default" @click.stop="handleMember">
            升级
          </t-button>
        </user-menu-row>
        <user-menu-row
          v-if="signedIn"
          :icon="WalletIcon"
          label="积分余额"
          arrow
          clickable
          @click="handlePoints"
        >
          <t-button
            variant="text"
            shape="square"
            size="small"
            title="刷新积分"
            :loading="refreshing"
            @click.stop="handleRefresh"
          >
            <template #icon>
              <refresh-icon />
            </template>
          </t-button>
          <span>{{ pointsLabel }}</span>
        </user-menu-row>
        <user-menu-row
          v-if="!signedIn"
          :icon="LoginIcon"
          label="登录 / 注册"
          arrow
          clickable
          @click="handleLogin"
        />

        <t-divider class="user-panel__rule" />

        <user-menu-row :icon="Setting1Icon" label="设置" clickable @click="handleSettings" />
        <user-menu-row
          :icon="LightbulbIcon"
          label="记忆与进化"
          clickable
          @click="goSetting('/setting/soul')"
        />
        <user-menu-row :icon="Palette1Icon" label="外观">
          <t-radio-group
            :value="appearance"
            theme="button"
            variant="default-filled"
            size="small"
            @change="handleAppearance"
          >
            <t-radio-button value="system">系统</t-radio-button>
            <t-radio-button value="light">浅色</t-radio-button>
            <t-radio-button value="dark">深色</t-radio-button>
          </t-radio-group>
        </user-menu-row>

        <t-divider v-if="signedIn" class="user-panel__rule" />
        <user-menu-row
          v-if="signedIn"
          :icon="LogoutIcon"
          label="退出登录"
          clickable
          danger
          @click="handleLogout"
        />
      </div>
    </template>
  </t-popup>
</template>
<script lang="ts" setup>
import {
  FileCopyIcon,
  LightbulbIcon,
  LoginIcon,
  LogoutIcon,
  Palette1Icon,
  RefreshIcon,
  Setting1Icon,
  UserIcon,
  WalletIcon
} from 'tdesign-icons-vue-next'
import { mode, setColorMode } from '@/global/BeanFactory'
import { useAuthStore } from '@/windows/main/store'
import { MessageUtil } from '@/utils/modal'
import { copyText } from '@/utils/native'
import { openLogin } from '@/components/modals/LoginDialog'
import { openMemberTier } from '@/windows/main/pages/setting/account/modals/MemberTierDialog'
import { openPointsLedger } from '@/windows/main/pages/setting/account/modals/PointsLedgerDrawer'
import UserMenuRow from './UserMenuRow.vue'

const overlayInnerStyle = {
  width: '272px',
  padding: '8px 0'
}

const router = useRouter()
const authStore = useAuthStore()
const visible = ref(false)
const refreshing = ref(false)

const signedIn = computed(() => authStore.status === 'signed-in')
const appearance = computed(() => mode.value)

const displayName = computed(() => {
  const account = authStore.user
  if (account && (account.name || account.email)) return account.name || account.email
  return '未登录'
})

const avatarText = computed(() => {
  const name = authStore.user?.name?.trim()
  return name ? name.slice(0, 1) : '未'
})

const tierLabel = computed(() => {
  const code = authStore.user?.tier
  if (!code) return '体验版'
  return authStore.tiers.find((item) => item.code === code)?.name ?? code
})

const pointsLabel = computed(() => {
  const total = authStore.balance?.total
  if (total == null) return '—'
  return total.toLocaleString('en-US')
})

function close(): void {
  visible.value = false
}

function onVisibleChange(next: boolean): void {
  if (next) void authStore.refreshIfStale()
}

function goSetting(path: string): void {
  close()
  if (router.currentRoute.value.path !== path) router.push(path)
}

function handleSettings(): void {
  close()
  if (!router.currentRoute.value.path.startsWith('/setting')) router.push('/setting/global')
}

function handleLogin(): void {
  close()
  openLogin()
}

function handleMember(): void {
  close()
  openMemberTier(authStore.tiers, authStore.user?.tier ?? null)
}

function handlePoints(): void {
  close()
  openPointsLedger()
}

async function handleCopy(): Promise<void> {
  const ok = await copyText(displayName.value)
  if (ok) MessageUtil.success('已复制用户名')
  else MessageUtil.error('复制失败')
}

async function handleRefresh(): Promise<void> {
  refreshing.value = true
  try {
    await authStore.refresh()
  } finally {
    refreshing.value = false
  }
}

function handleAppearance(value: string | number | boolean): void {
  if (value === 'system' || value === 'light' || value === 'dark') setColorMode(value)
}

async function handleLogout(): Promise<void> {
  close()
  const ok = await authStore.signOut()
  if (ok) MessageUtil.success('已退出登录')
}
</script>
<style scoped lang="less">
.menu-item {
  display: flex;
  align-items: center;
  gap: var(--td-comp-margin-s);
  width: calc(100% - 16px);
  min-width: 204px;
  min-height: var(--td-comp-size-m);
  padding: 0 var(--td-comp-paddingLR-s);
  color: var(--td-text-color-primary);
  font: var(--td-font-body-medium);
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--td-radius-small);
  outline: none;
  cursor: pointer;
  transition: background var(--fluent-transition-fast);

  &:hover {
    background: var(--fluent-item-hover);
  }

  &:focus-visible {
    box-shadow: var(--fluent-focus-ring);
  }

  &__name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.user-panel {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 4px;

  &__header {
    display: flex;
    align-items: center;
    gap: var(--td-comp-margin-xs);
    padding: 4px var(--td-comp-paddingLR-m) 8px;
  }

  &__name {
    overflow: hidden;
    font: var(--td-font-title-small);
    font-weight: 600;
    color: var(--td-text-color-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__rule {
    margin: 6px 12px !important;
  }
}
</style>
