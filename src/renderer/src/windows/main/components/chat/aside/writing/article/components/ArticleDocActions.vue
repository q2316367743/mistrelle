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
    <t-dropdown
      trigger="click"
      placement="top-left"
      :options="moreOptions"
      :disabled="humanizing"
      :min-column-width="180"
      :max-column-width="220"
      @click="handleMoreClick"
    >
      <t-button size="small" variant="text" :disabled="humanizing">
        <template #icon><more-icon /></template>
        更多
      </t-button>
    </t-dropdown>
    <slot name="extra" />
    <div class="doc-actions__spacer" />
    <span class="doc-actions__words">{{ words }} 字</span>
  </div>
</template>
<script lang="ts" setup>
import { h } from 'vue'
import {
  AiEditIcon,
  AiIcon,
  ContrastIcon,
  CopyIcon,
  FolderOpenIcon,
  MoreIcon,
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

/** 「更多」菜单：内容 / 文件 / 版本三段，用分隔线分组；版本对比平铺列出（窄栏内子菜单易被挤出屏幕） */
const moreOptions = computed<DropdownProps['options']>(() => {
  const options: NonNullable<DropdownProps['options']> = [
    { content: 'AI 检测', value: 'detect', prefixIcon: () => h(AiIcon) },
    { content: '复制正文', value: 'copy', prefixIcon: () => h(CopyIcon), divider: true },
    { content: '在文件夹中显示', value: 'reveal', prefixIcon: () => h(FolderOpenIcon), divider: true }
  ]
  if (otherVersions.value.length) {
    options.push(
      ...otherVersions.value.map((v) => ({
        content: articleVersionTitle(v),
        value: v.id,
        prefixIcon: () => h(ContrastIcon)
      }))
    )
  } else {
    options.push({
      content: '版本对比（暂无其他版本）',
      value: 'compare-none',
      prefixIcon: () => h(ContrastIcon),
      disabled: true
    })
  }
  return options
})

const handleMoreClick: DropdownProps['onClick'] = (data) => {
  const value = String(data.value)
  if (value === 'detect') emit('detect')
  else if (value === 'copy') emit('copy')
  else if (value === 'reveal') emit('reveal')
  else emit('compare', value)
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
