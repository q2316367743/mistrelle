<template>
  <div class="pack-checkout">
    <t-descriptions :column="1" :items="items" />
    <t-alert
      theme="warning"
      message="积分包有效期为 30 天，到期未用完自动清零，建议按需购买。"
    />
    <t-alert
      theme="info"
      message="平台暂不对接在线支付。确认规格后，用激活码开通；成交由激活码或管理端人工发放完成。"
    />
    <div class="pack-checkout__actions">
      <t-button variant="outline" @click="emit('close')">返回</t-button>
      <t-button theme="primary" @click="emit('redeem')">我有激活码</t-button>
    </div>
  </div>
</template>
<script lang="ts" setup>
import type { TdDescriptionsItemProps } from 'tdesign-vue-next'

const props = defineProps<{
  pack: AuthPackInfo
}>()
const emit = defineEmits<{ close: []; redeem: [] }>()

const items = computed<TdDescriptionsItemProps[]>(() => [
  { label: '名称', content: props.pack.name },
  { label: '积分', content: `${props.pack.points}` },
  { label: '价格', content: `¥${props.pack.price}（仅展示）` },
  {
    label: '有效期',
    content: '自兑换到账时刻起 30 天，到期未用完清零；可重复购买'
  }
])
</script>
<style scoped lang="less">
.pack-checkout {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pack-checkout__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
