<template>
  <div class="member-tier">
    <p class="member-tier__hint">档位按月计价，通过激活码开通与续期</p>
    <t-empty v-if="rows.length === 0" description="暂无档位信息" />
    <div v-else class="member-tier__list">
      <div
        v-for="tier in rows"
        :key="tier.code"
        :class="['member-tier__row', { 'is-current': tier.code === currentTier }]"
      >
        <div class="member-tier__info">
          <div class="member-tier__name">{{ tier.name }}</div>
          <div class="member-tier__quota">
            每日赠送 {{ tier.dailyGiftPoints }} 积分 · 基础 {{ tier.basePoints }} 积分
          </div>
          <div v-if="tier.perks.length" class="member-tier__perks">
            <span v-for="perk in tier.perks" :key="perk.key" class="member-tier__perk">
              <check-icon class="member-tier__perk-icon" />
              {{ perk.label }}
            </span>
          </div>
        </div>
        <div class="member-tier__aside">
          <t-tag
            v-if="tier.code === currentTier"
            theme="primary"
            variant="light"
            size="small"
          >
            当前
          </t-tag>
          <div class="member-tier__price">
            <template v-if="tier.price > 0">
              <span class="member-tier__price-num">¥{{ tier.price }}</span>
              <span class="member-tier__price-unit">/ 月</span>
            </template>
            <span v-else class="member-tier__price-free">免费</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { CheckIcon } from 'tdesign-icons-vue-next'

type FeatureKey = 'thirdPartyRelay' | 'extendedDesignStyles' | 'customFonts'

const FEATURES: Array<{ key: FeatureKey; label: string }> = [
  { key: 'thirdPartyRelay', label: '第三方中转' },
  { key: 'extendedDesignStyles', label: '更多设计风格' },
  { key: 'customFonts', label: '自定义字体' }
]

interface TierRow extends AuthTierInfo {
  perks: Array<{ key: FeatureKey; label: string }>
}

const props = defineProps<{ tiers: AuthTierInfo[]; currentTier: string | null }>()
defineEmits<{ close: [] }>()

const rows = computed<TierRow[]>(() =>
  [...props.tiers]
    .sort((a, b) => a.level - b.level)
    .map((tier) => ({
      ...tier,
      perks: FEATURES.filter((item) => tier[item.key])
    }))
)
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

.member-tier__list {
  display: flex;
  flex-direction: column;
}

.member-tier__row {
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

.member-tier__info {
  min-width: 0;
  flex: 1;
}

.member-tier__name {
  font: var(--td-font-title-medium);
  color: var(--td-text-color-primary);
}

.member-tier__quota {
  margin-top: 4px;
  font: var(--td-font-body-small);
  color: var(--td-text-color-secondary);
}

.member-tier__perks {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-top: 10px;
}

.member-tier__perk {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font: var(--td-font-body-small);
  color: var(--td-text-color-secondary);
}

.member-tier__perk-icon {
  font-size: 14px;
  color: var(--td-brand-color);
}

.member-tier__aside {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  min-width: 88px;
}

.member-tier__price {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 4px;
  font-variant-numeric: tabular-nums;
}

.member-tier__price-num,
.member-tier__price-free {
  font: var(--td-font-title-medium);
  color: var(--td-text-color-primary);
}

.member-tier__price-unit {
  font: var(--td-font-body-small);
  color: var(--td-text-color-secondary);
}
</style>
