<template>
  <div class="pack-select">
    <p class="pack-select__hint">
      兑换后计入永久积分，永不过期，可重复购买叠加。开通走激活码，不对接在线支付。
    </p>
    <t-empty v-if="rows.length === 0" description="暂无可购增量包" />
    <div v-else class="pack-select__list">
      <div
        v-for="pack in rows"
        :key="pack.code"
        class="pack-select__row"
        role="button"
        tabindex="0"
        @click="emit('pick', pack)"
        @keydown.enter.prevent="emit('pick', pack)"
      >
        <div class="pack-select__info">
          <div class="pack-select__name">{{ pack.name }}</div>
          <div class="pack-select__quota">+{{ pack.points }} 积分 · 永久有效</div>
        </div>
        <div class="pack-select__price">
          <span class="pack-select__price-num">¥{{ pack.price }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
const props = defineProps<{ catalog: AuthPackCatalog }>()
const emit = defineEmits<{ close: []; pick: [pack: AuthPackInfo] }>()

const rows = computed(() => [...props.catalog.items].sort((a, b) => a.sort - b.sort))
</script>
<style scoped lang="less">
.pack-select {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pack-select__hint {
  margin: 0 0 4px;
  font: var(--td-font-body-small);
  color: var(--td-text-color-secondary);
}

.pack-select__list {
  display: flex;
  flex-direction: column;
}

.pack-select__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: calc(100% - 24px);
  padding: 14px 12px;
  border: 0;
  border-radius: var(--fluent-radius-smooth);
  background: transparent;
  text-align: left;
  cursor: pointer;
  color: inherit;
  outline: none;
  transition: background-color var(--fluent-transition-fast);

  & + & {
    border-top: 1px solid var(--td-component-stroke);
  }

  &:hover {
    background: var(--fluent-item-hover);
  }

  &:focus-visible {
    box-shadow: var(--fluent-focus-ring);
  }
}

.pack-select__name {
  font: var(--td-font-title-medium);
  color: var(--td-text-color-primary);
}

.pack-select__quota {
  margin-top: 4px;
  font: var(--td-font-body-small);
  color: var(--td-text-color-secondary);
}

.pack-select__price {
  display: flex;
  align-items: baseline;
  gap: 4px;
  font-variant-numeric: tabular-nums;
}

.pack-select__price-num {
  font: var(--td-font-title-medium);
  color: var(--td-text-color-primary);
}

.pack-select__price-unit {
  font: var(--td-font-body-small);
  color: var(--td-text-color-secondary);
}

.pack-select__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
</style>
