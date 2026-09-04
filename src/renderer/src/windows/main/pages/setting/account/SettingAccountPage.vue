<template>
  <page-layout title="账号设置">
    <div class="account-page">
      <server-account-card />
      <account-action-list v-if="authStore.status === 'signed-in'" />
      <third-party-account-card />
    </div>
  </page-layout>
</template>
<script lang="ts" setup>
import { useAuthStore } from '@/windows/main/store'
import ServerAccountCard from './components/ServerAccountCard.vue'
import AccountActionList from './components/AccountActionList.vue'
import ThirdPartyAccountCard from './components/ThirdPartyAccountCard.vue'

const authStore = useAuthStore()
let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  void authStore.refreshIfStale()
  timer = setInterval(() => {
    void authStore.refreshIfStale()
  }, 60_000)
})

onUnmounted(() => {
  if (timer !== undefined) clearInterval(timer)
})
</script>
<style scoped lang="less">
.account-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  padding: 8px 24px 32px;
  box-sizing: border-box;
}

.account-page__lead {
  margin: 0;
  font: var(--td-font-body-medium);
  color: var(--td-text-color-secondary);
}
</style>
