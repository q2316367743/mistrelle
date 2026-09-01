<template>
  <div class="ledger">
    <t-alert v-if="error" theme="error" :message="error" class="ledger__error" />
    <t-table
      row-key="id"
      size="small"
      :columns="columns"
      :data="items"
      :loading="loading"
      :empty="emptyText"
    >
      <template #time="{ row }">{{ formatTime(row.createdAt) }}</template>
      <template #type="{ row }">
        <t-tag size="small" variant="light" :theme="typeTheme(row.type)">
          {{ typeLabel(row.type) }}
        </t-tag>
      </template>
      <template #amount="{ row }">
        <span :class="amountClass(row.amount)">{{ formatAmount(row.amount) }}</span>
      </template>
      <template #balance="{ row }">{{ row.giftAfter + row.totalAfter + row.paidAfter }}</template>
      <template #remark="{ row }">{{ row.remark || '—' }}</template>
    </t-table>
    <t-pagination
      v-if="total > 0"
      v-model:current="page"
      v-model:page-size="pageSize"
      class="ledger__pager"
      :total="total"
      :page-size-options="[10, 20, 50]"
      show-jumper
      @change="load"
    />
  </div>
</template>
<script lang="ts" setup>
import type { TableProps, TagProps } from 'tdesign-vue-next'
import { toDateString } from '@/utils/lang/FormatUtil'

defineEmits<{ close: [] }>()

const loading = ref(false)
const error = ref('')
const items = ref<AuthPointsTransaction[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const emptyText = '暂无积分流水'

const TYPE_LABEL: Record<AuthPointsTxType, string> = {
  consume: '消耗',
  recharge: '充值',
  refund: '退款',
  admin_adjust: '调整',
  gift_reset: '每日赠送',
  tier_grant: '档位发放'
}

const TYPE_THEME: Record<AuthPointsTxType, TagProps['theme']> = {
  consume: 'danger',
  recharge: 'success',
  refund: 'warning',
  admin_adjust: 'primary',
  gift_reset: 'default',
  tier_grant: 'primary'
}

const columns: TableProps['columns'] = [
  { colKey: 'createdAt', title: '时间', cell: 'time', width: 168 },
  { colKey: 'type', title: '类型', cell: 'type', width: 100 },
  { colKey: 'amount', title: '变动', cell: 'amount', width: 88, align: 'right' },
  { colKey: 'balance', title: '结余', cell: 'balance', width: 80, align: 'right' },
  { colKey: 'remark', title: '备注', cell: 'remark', ellipsis: true }
]

function typeLabel(type: AuthPointsTxType): string {
  return TYPE_LABEL[type] ?? type
}

function typeTheme(type: AuthPointsTxType): TagProps['theme'] {
  return TYPE_THEME[type] ?? 'default'
}

function formatTime(iso: string): string {
  return toDateString(iso, 'YYYY-MM-DD HH:mm')
}

function formatAmount(amount: number): string {
  if (amount > 0) return `+${amount}`
  return String(amount)
}

function amountClass(amount: number): string {
  if (amount > 0) return 'is-income'
  if (amount < 0) return 'is-expense'
  return ''
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const res = await window.preload.auth.listTransactions({
      page: page.value,
      pageSize: pageSize.value
    })
    if (!res.ok) {
      error.value = res.msg
      items.value = []
      total.value = 0
      return
    }
    items.value = res.data.items
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})
</script>
<style scoped lang="less">
.ledger {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 360px;
}

.ledger__error {
  flex: none;
}

.ledger__pager {
  flex: none;
  margin-top: auto;
}

.is-income {
  color: var(--td-success-color);
  font-weight: 600;
}

.is-expense {
  color: var(--td-error-color);
  font-weight: 600;
}
</style>
