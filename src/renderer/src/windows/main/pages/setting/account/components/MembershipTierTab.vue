<template>
  <div class="tier-tab">
    <t-empty v-if="rows.length === 0" description="暂无档位信息" />
    <div v-else class="tier-tab__list">
      <div
        v-for="tier in rows"
        :key="tier.code"
        :class="['tier-tab__row', { 'is-current': tier.code === currentTier }]"
      >
        <div class="tier-tab__info">
          <div class="tier-tab__name">{{ tier.name }}</div>
          <div class="tier-tab__quota">每日赠送 {{ tier.dailyGiftPoints }} 积分</div>
          <div v-if="tier.perks.length" class="tier-tab__perks">
            <span v-for="perk in tier.perks" :key="perk.key" class="tier-tab__perk">
              <check-icon class="tier-tab__perk-icon" />
              {{ perk.label }}
            </span>
          </div>
        </div>
        <div class="tier-tab__aside">
          <t-tag v-if="tier.code === currentTier" theme="primary" variant="light" size="small">
            当前
          </t-tag>
          <span v-if="tier.category === 'free'" class="tier-tab__free">免费</span>
          <div v-else-if="tier.offers.length" class="tier-tab__offers">
            <t-button
              v-for="offer in tier.offers"
              :key="offer.goodsNo"
              size="small"
              theme="primary"
              variant="outline"
              @click="handleBuy(offer)"
            >
              {{ monthLabel(offer.months) }}{{ priceSuffix(offer) }}
            </t-button>
          </div>
          <span v-else class="tier-tab__off">暂未上架</span>
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { CheckIcon } from 'tdesign-icons-vue-next'
import { fenLabel, monthLabel, openPurchase } from '../modals/offer'

type FeatureKey = 'thirdPartyRelay' | 'extendedDesignStyles' | 'customFonts' | 'extendedCardStyles'

const FEATURES: Array<{ key: FeatureKey; label: string }> = [
  { key: 'thirdPartyRelay', label: '第三方中转' },
  { key: 'extendedDesignStyles', label: '更多设计风格' },
  { key: 'extendedCardStyles', label: '自定义卡片风格' },
  { key: 'customFonts', label: '自定义字体' }
]

interface TierRow extends AuthTierInfo {
  perks: Array<{ key: FeatureKey; label: string }>
  /** 兜底旧服务端未下发 offers 的情况 */
  offers: AuthTierOffer[]
}

const props = defineProps<{ tiers: AuthTierInfo[]; currentTier: string | null }>()

const rows = computed<TierRow[]>(() =>
  [...props.tiers]
    .sort((a, b) => a.level - b.level)
    .map((tier) => ({
      ...tier,
      perks: FEATURES.filter((item) => tier[item.key]),
      // 按绑定月数排序，展示稳定
      offers: [...(tier.offers ?? [])].sort((a, b) => a.months - b.months)
    }))
)

/** 有平台价才带价格后缀；未同步时不显示（各规格总价不同，回落月价会误导） */
function priceSuffix(offer: AuthTierOffer): string {
  const label = fenLabel(offer.priceFen)
  return label ? ` ${label}` : ''
}

function handleBuy(offer: AuthTierOffer): void {
  openPurchase(offer.purchaseUrl)
}
</script>
<style scoped lang="less">
.tier-tab__list {
  display: flex;
  flex-direction: column;
}

.tier-tab__row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 12px;
  border-radius: var(--fluent-radius-smooth);
  transition: background-color var(--fluent-transition-fast);

  & + & {
    border-top: 1px solid var(--td-component-stroke);
  }

  &.is-current {
    background: var(--fluent-item-selected);
  }
}

.tier-tab__info {
  min-width: 0;
  flex: 1;
}

.tier-tab__name {
  font: var(--td-font-title-medium);
  color: var(--td-text-color-primary);
}

.tier-tab__quota {
  margin-top: 4px;
  font: var(--td-font-body-small);
  color: var(--td-text-color-secondary);
}

.tier-tab__perks {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-top: 10px;
}

.tier-tab__perk {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font: var(--td-font-body-small);
  color: var(--td-text-color-secondary);
}

.tier-tab__perk-icon {
  font-size: 14px;
  color: var(--td-brand-color);
}

.tier-tab__aside {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  min-width: 96px;
}

.tier-tab__offers {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.tier-tab__free,
.tier-tab__off {
  font: var(--td-font-title-medium);
  color: var(--td-text-color-primary);
}

.tier-tab__off {
  font: var(--td-font-body-small);
  color: var(--td-text-color-placeholder);
}
</style>
