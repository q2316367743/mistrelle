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
    <t-tooltip content="复制正文并打开朱雀官网检测">
      <t-button size="small" variant="text" :disabled="humanizing" @click="emit('detect')">
        <template #icon><ai-icon /></template>
        AI 检测
      </t-button>
    </t-tooltip>
    <t-tooltip content="在文件夹中显示正文文件">
      <t-button size="small" variant="text" @click="emit('reveal')">
        <template #icon><folder-open-icon /></template>
        文件夹
      </t-button>
    </t-tooltip>
    <t-tooltip content="复制当前正文 Markdown 到剪贴板">
      <t-button size="small" variant="text" :disabled="humanizing" @click="emit('copy')">
        <template #icon><copy-icon /></template>
        复制
      </t-button>
    </t-tooltip>
    <t-dropdown
      v-if="otherVersions.length"
      trigger="click"
      placement="bottom-right"
      min-column-width="160px"
      :disabled="humanizing"
      @click="handleCompare"
    >
      <t-button size="small" variant="text" :disabled="humanizing">
        <template #icon><contrast-icon /></template>
        版本对比
      </t-button>
      <t-dropdown-menu>
        <t-dropdown-item v-for="v in otherVersions" :key="v.id" :value="v.id">
          {{ articleVersionTitle(v) }}
        </t-dropdown-item>
      </t-dropdown-menu>
    </t-dropdown>
    <t-tooltip v-else content="暂无其他版本可对比">
      <t-button size="small" variant="text" disabled>
        <template #icon><contrast-icon /></template>
        版本对比
      </t-button>
    </t-tooltip>
    <div class="doc-actions__spacer" />
    <span class="doc-actions__words">{{ words }} 字</span>
  </div>
</template>
<script lang="ts" setup>
import {
  AiEditIcon,
  AiIcon,
  ContrastIcon,
  CopyIcon,
  FolderOpenIcon,
  StopCircleIcon
} from 'tdesign-icons-vue-next'
import { DropdownProps } from 'tdesign-vue-next'
import { useAuthStore } from '@/windows/main/store/AuthStore'
import { HUMANIZE_ENABLED } from '@/windows/main/modules/ai/humanize'
import type { ArticleVersion } from '@/windows/main/modules/tool/components/article/articleTypes'
import { articleVersionTitle } from '@/windows/main/modules/tool/components/article/articleTypes'

const props = defineProps<{
  /** 去 AI 味流式进行中 */
  humanizing?: boolean
  /** 实时字数（编辑器内容即时统计） */
  words: number
  /** 当前类型版本列表（供版本对比下拉） */
  versions?: ArticleVersion[]
  /** 当前激活版本 id */
  activeVersionId?: string
}>()

const emit = defineEmits<{
  (e: 'humanize'): void
  (e: 'abort'): void
  (e: 'copy'): void
  (e: 'detect'): void
  (e: 'reveal'): void
  (e: 'compare', versionId: string): void
}>()

const signedIn = computed(() => useAuthStore().status === 'signed-in')
const canHumanize = computed(() => HUMANIZE_ENABLED && signedIn.value)

/** 可对比版本：除当前激活版本外，新版本在上 */
const otherVersions = computed(() =>
  [...(props.versions ?? [])].filter((v) => v.id !== props.activeVersionId).reverse()
)

const handleCompare: DropdownProps['onClick'] = (data) => {
  emit('compare', String(data.value))
}

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
