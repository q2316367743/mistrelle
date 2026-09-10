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
        <span v-if="v.zhuque" class="chip-ring" title="已检测">
          <zhuque-pie :result="v.zhuque" :size="12" :legend="false" :center-label="false" />
        </span>
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

      <!-- AI 检测：结果跟版本走；有结果时按钮亮环，点击弹饼图 -->
      <t-tooltip v-if="!activeZhuque && !ZHUQUE_ENABLED" content="朱雀检测需企业认证接入，暂未开放">
        <span class="action-item">
          <t-button size="small" variant="outline" disabled>
            <template #icon><fact-check-icon /></template>
            AI 检测
          </t-button>
        </span>
      </t-tooltip>
      <t-tooltip v-else-if="!activeZhuque && ZHUQUE_ENABLED" content="检测当前版本的 AI 占比">
        <span class="action-item">
          <t-button size="small" variant="outline" :loading="detecting" :disabled="humanizing" @click="emit('detect')">
            <template #icon><fact-check-icon /></template>
            AI 检测
          </t-button>
        </span>
      </t-tooltip>
      <t-popup v-else trigger="click" placement="bottom-right" destroy-on-close>
        <span class="action-item">
          <t-button size="small" variant="outline" :loading="detecting" :disabled="humanizing">
            <template #icon><fact-check-icon /></template>
            AI 检测
          </t-button>
        </span>
        <template #content>
          <div class="detect-panel">
            <zhuque-pie v-if="activeZhuque" :result="activeZhuque" :size="96" />
            <div class="detect-panel__meta">
              检测于 {{ activeZhuque ? dayjs(activeZhuque.time).format('YYYY-MM-DD HH:mm') : '-' }}
            </div>
            <t-button
              v-if="ZHUQUE_ENABLED"
              size="small"
              variant="outline"
              block
              :loading="detecting"
              :disabled="humanizing"
              @click="emit('detect')"
            >
              重新检测
            </t-button>
          </div>
        </template>
      </t-popup>
    </div>
  </div>
</template>
<script lang="ts" setup>
import dayjs from 'dayjs'
import { AiEditIcon, CloseIcon, FactCheckIcon, StopCircleIcon } from 'tdesign-icons-vue-next'
import type { ArticleVersion } from '@/windows/main/modules/tool/components/article/articleTypes'
import { ARTICLE_VERSION_SOURCE_OPTIONS } from '@/windows/main/modules/tool/components/article/articleTypes'
import { useAuthStore } from '@/windows/main/store/AuthStore'
import { HUMANIZE_ENABLED, ZHUQUE_ENABLED } from '../humanizeApi'
import ZhuquePie from './ZhuquePie.vue'

const props = defineProps<{
  versions: ArticleVersion[]
  activeVersionId: string
  /** 去 AI 味进行中 */
  humanizing?: boolean
  /** 正在流式生成的版本 id */
  streamingVersionId?: string | null
  /** AI 检测进行中 */
  detecting?: boolean
}>()

const emit = defineEmits<{
  (e: 'select', versionId: string): void
  (e: 'remove', versionId: string): void
  (e: 'humanize'): void
  (e: 'abort'): void
  (e: 'detect'): void
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

/** 当前激活版本的检测结果（驱动检测按钮三态：禁用 / 可检测 / 可查看） */
const activeZhuque = computed(
  () => props.versions.find((v) => v.id === props.activeVersionId)?.zhuque
)

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

.chip-ring {
  display: flex;
  align-items: center;
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

.detect-panel {
  width: 220px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detect-panel__meta {
  font-size: var(--td-font-size-body-small);
  color: var(--td-text-color-placeholder);
}
</style>
