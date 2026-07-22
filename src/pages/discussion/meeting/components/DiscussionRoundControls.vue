<template>
  <div class="round-controls">
    <span class="round-controls__hint">第 {{ round }} 轮已完成。接下来你想怎么继续？</span>
    <div class="round-controls__actions">
      <t-button size="small" variant="outline" @click="emit('next')">
        <template #icon><refresh-icon /></template>
        再来一轮
      </t-button>
      <t-button size="small" variant="outline" @click="emit('supplement')">
        <template #icon><edit-icon /></template>
        我补充几句
      </t-button>
      <t-button size="small" variant="outline" @click="emit('settings')">
        <template #icon><setting-icon /></template>
        讨论设置
      </t-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { EditIcon, RefreshIcon, SettingIcon } from 'tdesign-icons-vue-next'

defineProps<{
  round: number
}>()

const emit = defineEmits<{
  next: []
  supplement: []
  settings: []
}>()
</script>

<style scoped lang="less">
.round-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--td-comp-margin-m);
  padding: var(--td-comp-paddingTB-s) var(--td-comp-paddingLR-l);
  border: 1px solid var(--fluent-card-border);
  border-radius: var(--fluent-radius-card);
  background: var(--fluent-card-bg);
  box-shadow: var(--fluent-card-shadow);
}

.round-controls__hint {
  color: var(--td-text-color-secondary);
  font: var(--td-font-body-small);
}

.round-controls__actions {
  display: flex;
  align-items: center;
  gap: var(--td-comp-margin-s);
}

@media (max-width: 820px) {
  .round-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .round-controls__actions {
    justify-content: flex-end;
  }
}
</style>
