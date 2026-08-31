<template>
  <div class="member-tier-content">
    <div class="member-tier-content__row">
      <div
        v-for="tier in tiers"
        :key="tier.code"
        :class="['member-tier-content__card', { 'is-current': tier.code === currentTier }]"
      >
        <div class="member-tier-content__head">
          <span class="member-tier-content__name">{{ tier.name }}</span>
          <t-tag v-if="tier.code === currentTier" variant="light" theme="success" size="small">
            当前档位
          </t-tag>
        </div>
        <div class="member-tier-content__price">
          <template v-if="tier.price > 0">
            <span class="member-tier-content__price-num">¥{{ tier.price }}</span>
            <span class="member-tier-content__price-unit">/ 月</span>
          </template>
          <span v-else class="member-tier-content__price-free">免费</span>
        </div>
        <div class="member-tier-content__quota">每日赠送 {{ tier.dailyGiftPoints }} 积分</div>
        <div class="member-tier-content__quota">基础赠送积分 {{ tier.basePoints }}</div>
        <div class="member-tier-content__features">
          <div
            v-for="feature in featureList"
            :key="feature.key"
            class="member-tier-content__feature"
          >
            <check-circle-icon
              v-if="tier[feature.key]"
              class="member-tier-content__feature-icon is-on"
            />
            <close-circle-icon v-else class="member-tier-content__feature-icon is-off" />
            <span class="member-tier-content__feature-label">{{ feature.label }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { CheckCircleIcon, CloseCircleIcon } from 'tdesign-icons-vue-next'

type FeatureKey = 'thirdPartyRelay' | 'extendedDesignStyles' | 'customFonts'

defineProps<{ tiers: AuthTierInfo[]; currentTier: string | null }>()
defineEmits<{ close: [] }>()

/** 能力清单：免费档全不打勾，付费档按各自权限打勾 */
const featureList: Array<{ key: FeatureKey; label: string }> = [
  { key: 'thirdPartyRelay', label: '第三方中转' },
  { key: 'extendedDesignStyles', label: '更多设计风格' },
  { key: 'customFonts', label: '自定义字体' }
]
</script>
<style scoped lang="less">
.member-tier-content {
  &__row {
    display: flex;
    flex-wrap: nowrap;
    gap: var(--td-comp-margin-m);
    margin-top: var(--td-comp-margin-m);
    padding-bottom: var(--td-comp-margin-xs);
    overflow-x: auto;
  }

  &__card {
    flex: 0 0 180px;
    display: flex;
    flex-direction: column;
    gap: var(--td-comp-margin-s);
    padding: var(--td-comp-paddingLR-l);
    background: var(--td-bg-color-container);
    border: 1px solid var(--td-component-border);
    border-radius: var(--td-radius-medium);
    transition:
      border-color var(--fluent-transition-fast),
      box-shadow var(--fluent-transition-fast);

    &.is-current {
      border-color: var(--td-brand-color);
      box-shadow: var(--td-shadow-1);
    }
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--td-comp-margin-xs);
  }

  &__name {
    font: var(--td-font-title-medium);
    color: var(--td-text-color-primary);
  }

  &__price {
    display: flex;
    align-items: baseline;
    gap: var(--td-comp-margin-xxs);
    margin-top: var(--td-comp-margin-xxs);

    &-num {
      font: var(--td-font-headline-large);
      color: var(--td-brand-color);
    }

    &-unit {
      font: var(--td-font-body-small);
      color: var(--td-text-color-secondary);
    }

    &-free {
      font: var(--td-font-headline-large);
      color: var(--td-text-color-primary);
    }
  }

  &__quota {
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
  }

  &__features {
    display: flex;
    flex-direction: column;
    gap: var(--td-comp-margin-xs);
  }

  &__feature {
    display: flex;
    align-items: center;
    gap: var(--td-comp-margin-xs);
    font: var(--td-font-body-medium);
    color: var(--td-text-color-primary);

    &-icon {
      font-size: var(--td-font-size-body-large);

      &.is-on {
        color: var(--td-success-color);
      }

      &.is-off {
        color: var(--td-text-color-disabled);
      }
    }
  }
}
</style>
