<template>
  <div class="humanize-depth">
    <div class="humanize-depth__hint">改写深度越大，去 AI 味越彻底；默认 5。</div>
    <div class="humanize-depth__value">深度 {{ depth }}</div>
    <t-slider v-model="depth" :min="1" :max="10" :step="1" :marks="marks" />
    <div class="humanize-depth__actions">
      <t-button variant="outline" @click="emit('close')">取消</t-button>
      <t-button theme="primary" @click="emit('confirm', depth)">开始改写</t-button>
    </div>
  </div>
</template>
<script lang="ts" setup>
const props = defineProps<{
  /** 初始深度 1~10 */
  defaultDepth?: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', depth: number): void
}>()

const clamp = (n: number): number => Math.min(10, Math.max(1, Math.round(n)))
const depth = ref(clamp(props.defaultDepth ?? 5))

const marks: Record<number, string> = {
  1: '轻',
  5: '中',
  10: '强'
}
</script>
<style scoped lang="less">
.humanize-depth {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 4px 0;
  width: calc(100% - 24px);
  padding-left: 12px;

  &__hint {
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-secondary);
  }

  &__value {
    font-size: var(--td-font-size-title-medium);
    color: var(--td-brand-color);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding-top: 32px;
  }
}
</style>
