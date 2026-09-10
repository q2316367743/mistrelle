<template>
  <div class="pack-tab">
    <div class="pack-tab__total">
      永久积分
      <span class="pack-tab__total-num">{{ permanent }}</span>
    </div>
    <t-empty v-if="rows.length === 0" description="暂无可购增量包" />
    <div v-else class="pack-tab__list">
      <div v-for="pack in rows" :key="pack.code" class="pack-tab__row">
        <div class="pack-tab__info">
          <div class="pack-tab__name">{{ pack.name }}</div>
          <div class="pack-tab__quota">+{{ pack.points }} 积分 · 永久有效</div>
        </div>
        <div class="pack-tab__aside">
          <span class="pack-tab__price">{{ priceLabel(pack) }}</span>
          <div v-if="pack.offers.length" class="pack-tab__offers">
            <t-button
              v-for="offer in pack.offers"
              :key="offer.goodsNo"
              size="small"
              theme="primary"
              variant="outline"
              @click="handleBuy(offer)"
            >
              购买
            </t-button>
          </div>
          <span v-else class="pack-tab__off">暂未上架</span>
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { fenLabel, openPurchase } from '../modals/offer'

interface PackRow extends AuthPackInfo {
  /** 兜底旧服务端未下发 offers 的情况 */
  offers: AuthPackOffer[]
}

const props = defineProps<{ catalog: AuthPackCatalog; permanent: number }>()

const rows = computed<PackRow[]>(() =>
  [...props.catalog.items]
    .sort((a, b) => a.sort - b.sort)
    .map((pack) => ({ ...pack, offers: pack.offers ?? [] }))
)

/** 优先展示平台实际售价；未同步时回落 SKU 标价（单规格不会误导） */
function priceLabel(pack: PackRow): string {
  return fenLabel(pack.offers[0]?.priceFen ?? null) ?? `¥${pack.price}`
}

function handleBuy(offer: AuthPackOffer): void {
  openPurchase(offer.purchaseUrl)
}
</script>
<style scoped lang="less">
.pack-tab {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pack-tab__total {
  font: var(--td-font-body-medium);
  color: var(--td-text-color-secondary);
}

.pack-tab__total-num {
  margin-left: 6px;
  font: var(--td-font-title-medium);
  color: var(--td-text-color-primary);
}

.pack-tab__list {
  display: flex;
  flex-direction: column;
}

.pack-tab__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 12px;
  border-radius: var(--fluent-radius-smooth);

  & + & {
    border-top: 1px solid var(--td-component-stroke);
  }
}

.pack-tab__info {
  min-width: 0;
  flex: 1;
}

.pack-tab__name {
  font: var(--td-font-title-medium);
  color: var(--td-text-color-primary);
}

.pack-tab__quota {
  margin-top: 4px;
  font: var(--td-font-body-small);
  color: var(--td-text-color-secondary);
}

.pack-tab__aside {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
}

.pack-tab__price {
  font: var(--td-font-title-medium);
  color: var(--td-text-color-primary);
  font-variant-numeric: tabular-nums;
}

.pack-tab__offers {
  display: flex;
  gap: 6px;
}

.pack-tab__off {
  font: var(--td-font-body-small);
  color: var(--td-text-color-placeholder);
}
</style>
