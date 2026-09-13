<template>
  <div class="doc-actions">
    <t-tooltip :content="humanizeTooltip" :disabled="!humanizeTooltip">
      <t-button
        v-if="humanizing"
        size="small"
        variant="outline"
        theme="warning"
        @click="emit('abort')"
      >
        <template #icon><stop-circle-icon /></template>
        停止
      </t-button>
      <t-button
        v-else
        size="small"
        variant="outline"
        :disabled="!canHumanize"
        @click="emit('humanize')"
      >
        <template #icon><ai-edit-icon /></template>
        去 AI 味
      </t-button>
    </t-tooltip>
    <div class="doc-actions__spacer" />
    <span class="doc-actions__words">{{ words }} 字</span>
    <t-tooltip content="复制当前正文 Markdown 到剪贴板">
      <t-button size="small" variant="text" :disabled="humanizing" @click="emit('copy')">
        <template #icon><copy-icon /></template>
        复制
      </t-button>
    </t-tooltip>
  </div>
</template>
<script lang="ts" setup>
import { AiEditIcon, CopyIcon, StopCircleIcon } from 'tdesign-icons-vue-next'
import { useAuthStore } from '@/windows/main/store/AuthStore'
import { HUMANIZE_ENABLED } from '@/windows/main/modules/ai/humanize'

const props = defineProps<{
  /** 去 AI 味流式进行中 */
  humanizing?: boolean
  /** 实时字数（编辑器内容即时统计） */
  words: number
}>()

const emit = defineEmits<{
  (e: 'humanize'): void
  (e: 'abort'): void
  (e: 'copy'): void
}>()

const signedIn = computed(() => useAuthStore().status === 'signed-in')
const canHumanize = computed(() => HUMANIZE_ENABLED && signedIn.value)

const humanizeTooltip = computed(() => {
  if (props.humanizing) return ''
  if (!HUMANIZE_ENABLED) return '流式接口暂未开放，敬请期待'
  if (!signedIn.value) return '请先登录'
  return ''
})
</script>
<style scoped lang="less">
.doc-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  border-top: 1px solid var(--td-border-level-1-color);
  background: var(--td-bg-color-container);
  padding: 6px 8px 0;

  &__spacer {
    flex: 1;
  }

  &__words {
    flex-shrink: 0;
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-placeholder);
    font-variant-numeric: tabular-nums;
  }
}
</style>
