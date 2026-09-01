<template>
  <div class="pack-lots">
    <p class="pack-lots__hint">
      每笔自发放时刻起 30 天有效，过期未用完作废；扣减时先到期先扣。用激活码兑换，可无限次购买叠加。
    </p>
    <t-alert v-if="error" theme="error" :message="error" />
    <div v-if="!error" class="pack-lots__total">
      有效剩余
      <span class="pack-lots__total-num">{{ remaining }}</span>
    </div>
    <t-empty v-if="!loading && lots.length === 0 && !error" description="暂无有效增量包" />
    <div v-else-if="lots.length" class="pack-lots__list">
      <div v-for="lot in lots" :key="lot.id" class="pack-lots__row">
        <div class="pack-lots__info">
          <div class="pack-lots__name">剩余 {{ lot.remaining }} / {{ lot.granted }}</div>
          <div class="pack-lots__meta">{{ sourceLabel(lot.source) }} · 到期 {{ formatDate(lot.expiresAt) }}</div>
        </div>
      </div>
    </div>
    <div class="pack-lots__actions">
      <t-button theme="primary" variant="outline" @click="handleSelect">选择增量包</t-button>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { useAuthStore } from '@/store'
import { toDateString } from '@/utils/lang/FormatUtil'
import { openPackSelect } from './PackSelectDialog'

defineEmits<{ close: [] }>()

const authStore = useAuthStore()
const loading = ref(false)
const error = ref('')
const remaining = ref(0)
const lots = ref<AuthPackLot[]>([])

const SOURCE_LABEL: Record<AuthPackLotSource, string> = {
  activation: '激活码',
  admin: '人工发放',
  legacy: '历史余额',
  login: '登录赠送'
}

function sourceLabel(source: AuthPackLotSource): string {
  return SOURCE_LABEL[source]
}

function formatDate(ms: number): string {
  return toDateString(ms, 'YYYY年M月D日')
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const res = await authStore.listPackLots()
    if (!res.ok) {
      error.value = res.msg
      lots.value = []
      remaining.value = 0
      return
    }
    remaining.value = res.data.remaining
    lots.value = res.data.items
  } finally {
    loading.value = false
  }
}

function handleSelect(): void {
  openPackSelect(authStore.packs)
}

onMounted(() => {
  void load()
})
</script>
<style scoped lang="less">
.pack-lots {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pack-lots__hint {
  margin: 0;
  font: var(--td-font-body-small);
  color: var(--td-text-color-secondary);
}

.pack-lots__total {
  font: var(--td-font-body-medium);
  color: var(--td-text-color-secondary);
}

.pack-lots__total-num {
  margin-left: 6px;
  font: var(--td-font-title-medium);
  color: var(--td-text-color-primary);
}

.pack-lots__list {
  display: flex;
  flex-direction: column;
}

.pack-lots__row {
  padding: 12px 4px;

  & + & {
    border-top: 1px solid var(--td-component-stroke);
  }
}

.pack-lots__name {
  font: var(--td-font-title-small);
  color: var(--td-text-color-primary);
}

.pack-lots__meta {
  margin-top: 4px;
  font: var(--td-font-body-small);
  color: var(--td-text-color-secondary);
}

.pack-lots__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
</style>
