<template>
  <div class="article-version-bar">
    <div class="article-version-bar__chips">
      <div
        v-for="v in versions"
        :key="v.id"
        class="version-chip"
        :class="{
          'is-active': v.id === activeVersionId,
          'is-streaming': v.id === streamingVersionId,
          'is-locked': humanizing && v.id !== streamingVersionId
        }"
        @click="onSelect(v.id)"
      >
        <span class="chip-label">{{ versionLabel(v) }}</span>
        <span class="chip-time">{{ dayjs(v.createdTime).format('MM-DD HH:mm') }}</span>
        <t-popconfirm
          v-if="versions.length > 1 && !humanizing"
          content="确认删除该版本？"
          theme="danger"
          @confirm="emit('remove', v.id)"
        >
          <span class="chip-remove" title="删除版本" @click.stop>
            <close-icon />
          </span>
        </t-popconfirm>
      </div>
    </div>

    <div class="article-version-bar__actions">
      <!-- 去 AI 味：未登录禁用；生成中改为停止 -->
      <t-tooltip :content="humanizeTooltip" :disabled="!humanizeTooltip">
        <span class="action-item">
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
        </span>
      </t-tooltip>

      <!-- AI 检测：朱雀仅面向企业接入，直接跳官网在默认浏览器检测 -->
      <t-tooltip content="在腾讯朱雀 AI 检测官网检测当前文章">
        <span class="action-item">
          <t-button size="small" variant="outline" :disabled="humanizing" @click="openZhuqueDetect">
            <template #icon><fact-check-icon /></template>
            AI 检测
          </t-button>
        </span>
      </t-tooltip>
    </div>
  </div>
</template>
<script lang="ts" setup>
import dayjs from 'dayjs'
import { AiEditIcon, CloseIcon, FactCheckIcon, StopCircleIcon } from 'tdesign-icons-vue-next'
import type { ArticleVersion } from '@/windows/main/modules/tool/components/article/articleTypes'
import { ARTICLE_VERSION_SOURCE_OPTIONS } from '@/windows/main/modules/tool/components/article/articleTypes'
import { useAuthStore } from '@/windows/main/store/AuthStore'
import { openUrlByBrowser } from '@/utils/native'
import { HUMANIZE_ENABLED } from '@/windows/main/modules/ai/humanize'

/** 腾讯朱雀 AI 检测官网（仅企业接入，这里引导用户到官网手动检测） */
const ZHUQUE_DETECT_URL = 'https://matrix.tencent.com/ai-detect/ai_gen_txt'

const props = defineProps<{
  versions: ArticleVersion[]
  activeVersionId: string
  /** 去 AI 味进行中 */
  humanizing?: boolean
  /** 正在流式生成的版本 id */
  streamingVersionId?: string | null
}>()

const emit = defineEmits<{
  (e: 'select', versionId: string): void
  (e: 'remove', versionId: string): void
  (e: 'humanize'): void
  (e: 'abort'): void
}>()

const auth = useAuthStore()
const signedIn = computed(() => auth.status === 'signed-in')
const canHumanize = computed(() => HUMANIZE_ENABLED && signedIn.value)

const humanizeTooltip = computed(() => {
  if (props.humanizing) return ''
  if (!HUMANIZE_ENABLED) return '流式接口暂未开放，敬请期待'
  if (!signedIn.value) return '请先登录'
  return ''
})

/** 打开朱雀 AI 检测官网，交由默认浏览器检测 */
const openZhuqueDetect = (): void => {
  openUrlByBrowser(ZHUQUE_DETECT_URL)
}

const versionLabel = (v: ArticleVersion): string =>
  v.label ?? ARTICLE_VERSION_SOURCE_OPTIONS.find((o) => o.value === v.source)?.label ?? '版本'

const onSelect = (versionId: string): void => {
  if (props.humanizing) return
  emit('select', versionId)
}
</script>
<style scoped lang="less">
.article-version-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--td-border-level-1-color);
  background: var(--td-bg-color-container);
}

.article-version-bar__chips {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.version-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: var(--td-radius-medium);
  border: 1px solid var(--td-border-level-1-color);
  background: var(--td-bg-color-secondarycontainer);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--td-brand-color);
    .chip-remove {
      opacity: 1;
    }
  }

  &.is-active {
    border-color: var(--td-brand-color);
    background: var(--td-brand-color-light);
    .chip-label {
      color: var(--td-brand-color);
      font-weight: 600;
    }
  }

  &.is-streaming {
    border-color: var(--td-brand-color);
    box-shadow: 0 0 0 1px var(--td-brand-color-focus);
    animation: streaming-pulse 1.2s ease-in-out infinite;
  }

  &.is-locked {
    cursor: not-allowed;
    opacity: 0.55;
    pointer-events: none;
  }
}

@keyframes streaming-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.72;
  }
}

.chip-label {
  font-size: var(--td-font-size-body-small);
  color: var(--td-text-color-primary);
}

.chip-time {
  font-size: var(--td-font-size-body-small);
  color: var(--td-text-color-placeholder);
  font-variant-numeric: tabular-nums;
}

.chip-remove {
  display: flex;
  align-items: center;
  color: var(--td-text-color-placeholder);
  opacity: 0;
  transition: opacity 0.2s ease;

  &:hover {
    color: var(--td-error-color);
  }
}

.article-version-bar__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.action-item {
  display: flex;
}
</style>
