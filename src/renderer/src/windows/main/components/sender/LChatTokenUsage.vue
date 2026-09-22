<template>
  <t-popup trigger="click" placement="top" :overlay-inner-style="popupStyle">
    <t-button shape="circle" variant="text" theme="default" class="l-chat-token" title="上下文用量">
      <t-progress
        :percentage="percent"
        theme="circle"
        :size="18"
        :label="false"
        :stroke-width="2"
      />
    </t-button>
    <template #content>
      <token-usage-panel
        :context-tokens="contextTokens"
        :context-window="contextWindow"
        :breakdown="breakdown"
      />
    </template>
  </t-popup>
</template>
<script lang="ts" setup>
import type { TokenBreakdown } from '@/domain'
import TokenUsagePanel from './TokenUsagePanel.vue'

const props = defineProps<{
  contextTokens: number
  contextWindow: number
  breakdown: TokenBreakdown
}>()

const popupStyle: Record<string, string> = { padding: '4px' }

/** 当前上下文占上下文窗口的百分比（圆环展示） */
const percent = computed(() => {
  if (props.contextWindow <= 0) return 0
  return Math.min(Math.round((props.contextTokens / props.contextWindow) * 100), 100)
})
</script>
<style scoped lang="less">
.l-chat-token {
  display: inline-flex;
  align-items: center;
  padding: 0 var(--td-comp-paddingLR-xs);
  cursor: pointer;
}
</style>
