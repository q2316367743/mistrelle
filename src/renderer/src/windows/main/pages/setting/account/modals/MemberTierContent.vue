<template>
  <div class="member-tier">
    <p class="member-tier__hint">
      会员按月计价，积分包兑换后计入永久积分。购买会跳转浏览器打开 16688 商品页，支付后拿到卡密，
      回到这里用激活码兑换即可开通。
    </p>
    <t-tabs v-model="activeTab" class="member-tier__tabs">
      <t-tab-panel value="tier" label="会员档位">
        <membership-tier-tab :tiers="tiers" :current-tier="currentTier" />
      </t-tab-panel>
      <t-tab-panel value="pack" label="积分增量包">
        <membership-pack-tab :catalog="packs" :permanent="permanent" />
      </t-tab-panel>
    </t-tabs>
    <div class="member-tier__actions">
      <t-button theme="primary" variant="outline" @click="handleRedeem">已有激活码？去兑换</t-button>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { useAuthStore } from '@/windows/main/store'
import { openRedeemCode } from './RedeemCodeDialog'
import MembershipTierTab from '../components/MembershipTierTab.vue'
import MembershipPackTab from '../components/MembershipPackTab.vue'

defineProps<{ tiers: AuthTierInfo[]; currentTier: string | null }>()
defineEmits<{ close: [] }>()

const authStore = useAuthStore()
const activeTab = ref('tier')
const packs = computed<AuthPackCatalog>(() => authStore.packs)
const permanent = computed(() => authStore.balance?.pointsPermanent ?? 0)

function handleRedeem(): void {
  openRedeemCode()
}
</script>
<style scoped lang="less">
.member-tier {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.member-tier__hint {
  margin: 0 0 4px;
  font: var(--td-font-body-small);
  color: var(--td-text-color-secondary);
}

.member-tier__tabs {
  margin-top: 4px;
}

.member-tier__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}
</style>
