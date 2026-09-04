<template>
  <div class="builtin-panel">
    <header class="builtin-panel__header">
      <div>
        <h2 class="builtin-panel__name">{{ name }}</h2>
        <p class="builtin-panel__desc">
          内置服务端中转供应商，模型列表来自服务端 /v1/models，按积分计费
        </p>
      </div>
      <t-button
        theme="primary"
        variant="outline"
        :loading="refreshing"
        :disabled="!signedIn"
        @click="emit('refresh')"
      >
        <template #icon><RefreshIcon /></template>
        刷新模型列表
      </t-button>
    </header>

    <section class="builtin-panel__surface">
      <template v-if="!signedIn">
        <t-empty description="登录后可获取内置模型列表" />
      </template>
      <provider-model-list
        v-else
        :models="models"
        readonly
        empty-text="暂无模型，点击右上角刷新"
      />
    </section>
  </div>
</template>

<script lang="ts" setup>
import { RefreshIcon } from 'tdesign-icons-vue-next'
import type { AiModel } from '@/entity'
import ProviderModelList from './ProviderModelList.vue'

defineProps<{
  name: string
  models: AiModel[]
  refreshing: boolean
  signedIn: boolean
}>()

const emit = defineEmits<{
  refresh: []
}>()
</script>

<style scoped lang="less">
.builtin-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 720px;
  padding: 8px 8px 32px;
  box-sizing: border-box;
}

.builtin-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.builtin-panel__name {
  margin: 0;
  font: var(--td-font-title-large);
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.builtin-panel__desc {
  margin: 4px 0 0;
  font: var(--td-font-body-medium);
  color: var(--td-text-color-secondary);
}

.builtin-panel__surface {
  background: var(--fluent-card-bg);
  border: 1px solid var(--fluent-card-border);
  border-radius: var(--fluent-radius-card);
  box-shadow: var(--fluent-elevation-1);
  padding: 16px;
}
</style>
