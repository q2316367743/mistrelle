<template>
  <div class="pack-lots">
    <p class="pack-lots__hint">
      增量包兑换后计入永久积分，永不过期；扣费时先用每日赠送，再用永久积分。用激活码兑换，可无限次购买叠加。
    </p>
    <div class="pack-lots__total">
      永久积分
      <span class="pack-lots__total-num">{{ permanent }}</span>
    </div>
    <div class="pack-lots__actions">
      <t-button theme="primary" variant="outline" @click="handleSelect">选择增量包</t-button>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { useAuthStore } from '@/windows/main/store'
import { openPackSelect } from './PackSelectDialog'

defineEmits<{ close: [] }>()

const authStore = useAuthStore()
const permanent = computed(() => authStore.balance?.pointsPermanent ?? 0)

function handleSelect(): void {
  openPackSelect(authStore.packs)
}
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

.pack-lots__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
</style>
